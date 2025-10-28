// --- Core Dependencies ---
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Client } = require("@notionhq/client");
const jwt = require("jsonwebtoken");
const fetch = require("node-fetch");

// --- Local Dependencies ---
const configStore = require("./config/configStore");
const setupRoutes = require("./config/setupRoutes");
const {
  updateDatabaseSchema,
  migrateDatabase,
  fillApprovalStatusFromStatus,
} = require("./config/databaseMigration");
const { STREAMER_SCHEMA, VIEWER_SCHEMA } = require("./config/databaseSchemas");
const {
  validateSchema,
  createDatabase,
  findDatabaseByTitle,
} = require("./config/setupHelpers");

// --- Environment Variable Setup ---
const {
  NOTION_API_KEY,
  TWITCH_EXTENSION_SECRET,
  STREAMER_DATABASE_ID,
  VIEWER_DATABASE_ID,
} = process.env;

// --- Initialization ---
const app = express();
const PORT = process.env.PORT || 8081; // Extensions often use 8081 for the EBS

// Serve static files
app.use(express.static(__dirname));
const notion = new Client({ auth: NOTION_API_KEY });

// --- Middleware ---
app.use(cors()); // Allow requests from the Twitch extension frontend
app.use(express.json()); // Allow the server to parse JSON request bodies

// Simple request logger to aid debugging during local development
app.use((req, res, next) => {
  try {
    console.log(`[HTTP] ${req.method} ${req.path} - headers:`, {
      authorization: req.headers.authorization ? "<redacted>" : undefined,
    });
  } catch (err) {
    // ignore logging errors
  }
  next();
});

// Initialize config store
configStore.init().catch(console.error);

// --- Twitch JWT Verification Middleware ---
// Every request from the extension will have a JWT. We must verify it.
function verifyTwitchJWT(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1]; // Get token from "Bearer <token>"
  if (!token) {
    return res.status(401).send("Unauthorized: Missing token");
  }

  try {
    // The secret must be Base64 decoded, as per Twitch's documentation
    const decodedSecret = Buffer.from(TWITCH_EXTENSION_SECRET, "base64");
    const decodedToken = jwt.verify(token, decodedSecret);

    // Attach user info to the request for later use
    req.twitch = decodedToken;

    next(); // Token is valid, proceed to the actual API endpoint
  } catch (err) {
    console.error("JWT Verification Error:", err.message);
    return res.status(401).send("Unauthorized: Invalid token");
  }
}

// --- Setup Endpoint ---
app.post("/setup", verifyTwitchJWT, async (req, res) => {
  // Only allow broadcaster to perform setup
  if (req.twitch.role !== "broadcaster") {
    return res.status(403).send("Only the broadcaster can perform setup");
  }

  const { parentPageId } = req.body;
  if (!parentPageId) {
    return res.status(400).send("Parent page ID is required");
  }

  try {
    // Check for existing databases
    let streamerDbId = await findDatabaseByTitle(notion, STREAMER_SCHEMA.name);
    let viewerDbId = await findDatabaseByTitle(notion, VIEWER_SCHEMA.name);

    const setup = {
      streamer: {
        exists: !!streamerDbId,
        valid: streamerDbId
          ? await validateSchema(notion, streamerDbId, STREAMER_SCHEMA)
          : false,
      },
      viewer: {
        exists: !!viewerDbId,
        valid: viewerDbId
          ? await validateSchema(notion, viewerDbId, VIEWER_SCHEMA)
          : false,
      },
    };

    // If databases don't exist or aren't valid, create them
    if (!setup.streamer.exists || !setup.streamer.valid) {
      streamerDbId = await createDatabase(
        notion,
        STREAMER_SCHEMA,
        parentPageId,
      );
    }
    if (!setup.viewer.exists || !setup.viewer.valid) {
      viewerDbId = await createDatabase(notion, VIEWER_SCHEMA, parentPageId);
    }

    // The client-side Javascript is responsible for saving the database IDs to the
    // Twitch Configuration Service after this endpoint returns successfully.

    res.json({
      message: "Setup completed successfully",
      databases: {
        streamer: { id: streamerDbId, ...setup.streamer },
        viewer: { id: viewerDbId, ...setup.viewer },
      },
    });
  } catch (error) {
    console.error("Setup error:", error);
    res.status(500).json({
      message: "Error during setup",
      error: error.message,
    });
  }
});

// --- Setup Routes ---
app.use("/setup", verifyTwitchJWT, setupRoutes);

// --- API Endpoints for the Extension ---

// --- Twitch Configuration Service Helpers ---

// Generates a short-lived JWT for server-to-server calls to the Twitch API
function generateTwitchApiJwt(channelId, userId) {
  const payload = {
    exp: Math.floor(Date.now() / 1000) + 60, // Expires in 1 minute
    user_id: userId,
    role: "external",
    channel_id: channelId,
  };
  const secret = Buffer.from(TWITCH_EXTENSION_SECRET, "base64");
  return jwt.sign(payload, secret);
}

// Fetches the broadcaster-specific configuration segment from the Twitch API
async function getBroadcasterConfig(channelId, userId) {
  if (!process.env.TWITCH_CLIENT_ID) {
    console.warn(
      "[EBS] TWITCH_CLIENT_ID is not set. Cannot fetch broadcaster config.",
    );
    return null;
  }

  const url = `https://api.twitch.tv/extensions/${process.env.TWITCH_CLIENT_ID}/configurations/segments/broadcaster?channel_id=${channelId}`;
  const token = generateTwitchApiJwt(channelId, userId);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Client-ID": process.env.TWITCH_CLIENT_ID,
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(
        `[EBS] Twitch API error (${response.status}): ${errorBody}`,
      );
      throw new Error(
        `Failed to fetch Twitch config: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();
    if (data && data.length > 0 && data[0].content) {
      return JSON.parse(data[0].content);
    }
    return null; // No configuration found
  } catch (error) {
    console.error("[EBS] Exception fetching broadcaster config:", error);
    return null; // Ensure we always return null on error
  }
}

// GET /tasks - Fetches all active tasks
// This endpoint is "public" in the sense that any viewer can see the tasks.
app.get("/tasks", verifyTwitchJWT, async (req, res) => {
  const channelId = req.twitch.channel_id;
  console.log(
    `[EBS] Received GET /tasks request from user: ${req.twitch.user_id} for channel: ${channelId}`,
  );

  let streamerDbId;
  let viewerDbId;

  try {
    const broadcasterConfig = await getBroadcasterConfig(
      req.twitch.channel_id,
      req.twitch.user_id,
    );
    if (broadcasterConfig) {
      streamerDbId = broadcasterConfig.streamerDbId;
      viewerDbId = broadcasterConfig.viewerDbId;
    }
  } catch (err) {
    console.error(
      "[EBS] Failed to get broadcaster config from Twitch, falling back to env.",
      err,
    );
  }

  // Fallback to env variables if Twitch config is not available for any reason
  streamerDbId = streamerDbId || STREAMER_DATABASE_ID;
  viewerDbId = viewerDbId || VIEWER_DATABASE_ID;

  if (!streamerDbId || !viewerDbId) {
    console.warn(
      `[EBS] Database IDs not found for channel ${channelId}. The broadcaster may need to run setup.`,
    );
    // Return empty task lists to avoid errors on the frontend
    return res.json({ streamerTasks: [], viewerTasks: [] });
  }

  console.log(
    `[EBS] Using streamerDbId=${streamerDbId}, viewerDbId=${viewerDbId} to fetch tasks`,
  );

  try {
    const tasks = await getTasksForOverlay(streamerDbId, viewerDbId);
    res.json(tasks);
  } catch (error) {
    console.error(
      "[EBS] CRITICAL ERROR in /tasks route:",
      error.stack || error,
    );
    res
      .status(500)
      .json({ message: "Internal server error.", error: error.message });
  }
});

// POST /tasks - A viewer submits a new task
app.post("/tasks", verifyTwitchJWT, async (req, res) => {
  const { taskDescription } = req.body;

  if (!taskDescription || taskDescription.trim().length === 0) {
    return res
      .status(400)
      .json({ message: "Task description cannot be empty." });
  }

  // Block clearly prohibited content immediately to protect viewers and streamers
  if (containsProhibited(taskDescription)) {
    console.warn(
      `[EBS] Rejected submission from ${req.twitch.opaque_user_id} due to prohibited content: ${taskDescription}`,
    );
    return res.status(400).json({
      message: "Task contains prohibited content and was not submitted.",
    });
  }

  const channelId = req.twitch.channel_id;
  // Use the opaque_user_id to track who submitted the task
  const submitterId = req.twitch.opaque_user_id;
  console.log(
    `[EBS] User ${submitterId} is submitting task: "${taskDescription}" for channel: ${channelId}`,
  );

  try {
    await addViewerTask(submitterId, taskDescription.trim());
    res
      .status(201)
      .json({ message: "Task submitted successfully for approval!" });
  } catch (error) {
    console.error("Error submitting task to Notion:", error);
    res.status(500).json({ message: "Error submitting task." });
  }
});

// PUT /tasks/:pageId/approve - A moderator approves a task
app.put("/tasks/:pageId/approve", verifyTwitchJWT, async (req, res) => {
  // We get role from the JWT, which is secure
  if (req.twitch.role !== "broadcaster" && req.twitch.role !== "moderator") {
    return res
      .status(403)
      .send("Forbidden: Only moderators or the broadcaster can approve tasks.");
  }
  const { pageId } = req.params;
  console.log(
    `[EBS] Mod/Broadcaster is approving task with page ID: ${pageId}`,
  );

  try {
    // Fetch the page to inspect the title before approving
    const page = await notion.pages.retrieve({ page_id: pageId });
    const title = page.properties.Task?.title[0]?.plain_text || "";
    if (containsProhibited(title)) {
      // Auto-reject prohibited content to avoid showing it even when a moderator attempts approval
      await notion.pages.update({
        page_id: pageId,
        archived: true,
        properties: { "Approval Status": { select: { name: "Rejected" } } },
      });
      console.warn(
        `[EBS] Auto-rejected approval of prohibited task ${pageId}: ${title}`,
      );
      return res.status(400).json({
        message:
          "Task contains prohibited content and was rejected by the system.",
      });
    }

    await notion.pages.update({
      page_id: pageId,
      properties: {
        "Approval Status": { select: { name: "Approved" } },
      },
    });
    res.json({ message: "Task approved!" });
  } catch (error) {
    console.error("Error approving task in Notion:", error);
    res.status(500).json({ message: "Error approving task." });
  }
});

// PUT /tasks/:pageId/complete - Moderator/Broadcaster can mark a specific page as completed
app.put("/tasks/:pageId/complete", verifyTwitchJWT, async (req, res) => {
  const { pageId } = req.params;
  const { completed } = req.body;

  // Only broadcaster or moderator may mark arbitrary pages complete
  if (req.twitch.role !== "broadcaster" && req.twitch.role !== "moderator") {
    return res
      .status(403)
      .send(
        "Forbidden: Only moderators or the broadcaster can mark tasks complete.",
      );
  }

  if (typeof completed !== "boolean") {
    return res
      .status(400)
      .json({ message: "Request body must include boolean 'completed'." });
  }

  try {
    await notion.pages.update({
      page_id: pageId,
      properties: { Completed: { checkbox: completed } },
    });
    res.json({
      message: `Task ${pageId} marked as ${completed ? "completed" : "not completed"}.`,
    });
  } catch (error) {
    console.error("Error updating task completion in Notion:", error);
    res.status(500).json({ message: "Error updating task completion." });
  }
});

// PUT /tasks/me/complete - A viewer can mark their own approved task as completed
app.put("/tasks/me/complete", verifyTwitchJWT, async (req, res) => {
  const opaque = req.twitch.opaque_user_id;
  const { completed } = req.body;

  if (typeof completed !== "boolean") {
    return res
      .status(400)
      .json({ message: "Request body must include boolean 'completed'." });
  }

  try {
    const msg = await updateViewerTaskStatus(opaque, completed);
    res.json({ message: msg });
  } catch (error) {
    console.error("Error updating viewer task status:", error);
    res.status(500).json({ message: "Error updating viewer task status." });
  }
});
// --- Notion Helper Functions ---

const dataSourceCache = new Map();

// Simple prohibited content checker. Keep this list conservative and update as needed.
const PROHIBITED_PATTERNS = [
  /kill\s+yourself/i,
  /kill\s+your\s+self/i,
  /suicid/i,
  /die\s+yourself/i,
  /go\s+die/i,
];

function containsProhibited(text) {
  if (!text || typeof text !== "string") return false;
  for (const rx of PROHIBITED_PATTERNS) {
    if (rx.test(text)) return true;
  }
  return false;
}

async function getDataSourceId(databaseId) {
  if (dataSourceCache.has(databaseId)) {
    return dataSourceCache.get(databaseId);
  }
  try {
    const response = await notion.databases.retrieve({
      database_id: databaseId,
    });
    if (response.data_sources && response.data_sources.length > 0) {
      const dataSourceId = response.data_sources[0].id;
      dataSourceCache.set(databaseId, dataSourceId);
      return dataSourceId;
    }
    return null;
  } catch (error) {
    console.error(
      `Failed to get data source ID for DB ${databaseId}:`,
      error.body || error,
    );
    return null;
  }
}

async function findUserTask(opaque_user_id, approvalStatus) {
  const dataSourceId = await getDataSourceId(VIEWER_DATABASE_ID);
  if (!dataSourceId) return null;
  try {
    // First try to find by the new `Approval Status` property (select)
    let response = await notion.dataSources.query({
      data_source_id: dataSourceId,
      filter: {
        and: [
          { property: "Suggested by", rich_text: { equals: opaque_user_id } },
          { property: "Approval Status", select: { equals: approvalStatus } },
        ],
      },
    });

    if (response.results && response.results.length > 0) {
      return response.results[0];
    }

    // Fallback: some installs use the `Status` property instead of `Approval Status`.
    response = await notion.dataSources.query({
      data_source_id: dataSourceId,
      filter: {
        and: [
          { property: "Suggested by", rich_text: { equals: opaque_user_id } },
          { property: "Status", status: { equals: approvalStatus } },
        ],
      },
    });

    return response.results.length > 0 ? response.results[0] : null;
  } catch (error) {
    console.error(
      `[NOTION] Error finding task for ${opaque_user_id}:`,
      error.body || error,
    );
    return null;
  }
}

async function addViewerTask(opaque_user_id, taskDescription) {
  try {
    if (!VIEWER_DATABASE_ID) {
      throw new Error("Viewer database ID not found in environment variables.");
    }
    await notion.pages.create({
      parent: { database_id: VIEWER_DATABASE_ID },
      properties: {
        Task: { title: [{ text: { content: taskDescription } }] },
        "Suggested by": { rich_text: [{ text: { content: opaque_user_id } }] },
        Status: { status: { name: "Pending" } },
        // Also set Approval Status (new select) to Pending so older DBs don't have nulls
        "Approval Status": { select: { name: "Pending" } },
        Completed: { checkbox: false },
        Role: { select: { name: "Viewer" } },
      },
    });
    console.log(
      `[NOTION] Added task for ${opaque_user_id}: "${taskDescription}"`,
    );
  } catch (error) {
    console.error("[NOTION] Error adding task:", error.body || error);
  }
}

async function approveViewerTask(opaque_user_id) {
  const task = await findUserTask(opaque_user_id, "Pending");
  if (task) {
    await notion.pages.update({
      page_id: task.id,
      properties: { "Approval Status": { select: { name: "Approved" } } },
    });
    console.log(`[NOTION] Approved task for ${opaque_user_id}`);
    return `Task for @${opaque_user_id} has been approved!`;
  }
  return `No pending task found for @${opaque_user_id}.`;
}

async function rejectViewerTask(opaque_user_id) {
  const task = await findUserTask(opaque_user_id, "Pending");
  if (task) {
    await notion.pages.update({ page_id: task.id, archived: true });
    console.log(`[NOTION] Rejected (archived) task for ${opaque_user_id}`);
    return `Task for @${opaque_user_id} has been rejected.`;
  }
  return `No pending task found for @${opaque_user_id} to reject.`;
}

async function updateViewerTaskStatus(opaque_user_id, isComplete) {
  const task = await findUserTask(opaque_user_id, "Approved");
  if (task) {
    await notion.pages.update({
      page_id: task.id,
      // Mark the task as completed by toggling the `Completed` checkbox.
      // `Status` is a status property in the viewer DB; `Completed` is the boolean flag.
      properties: { Completed: { checkbox: isComplete } },
    });
    const statusText = isComplete ? "completed" : "reset to active";
    console.log(`[NOTION] Task for ${opaque_user_id} marked as ${statusText}`);
    return `@${opaque_user_id}'s task has been marked as ${statusText}!`;
  }
  return `@${opaque_user_id}, no active task found for you to update.`;
}

async function getTasksForOverlay(streamerDbId, viewerDbId) {
  try {
    if (!streamerDbId || !viewerDbId) {
      throw new Error("Database IDs not configured for this channel.");
    }

    const [streamerResponse, viewerResponse] = await Promise.all([
      notion.databases.query({
        database_id: streamerDbId,
        filter: { property: "Completed", checkbox: { equals: false } },
      }),
      notion.databases.query({
        database_id: viewerDbId,
        filter: {
          and: [
            { property: "Status", status: { equals: "Approved" } },
            { property: "Completed", checkbox: { equals: false } },
          ],
        },
      }),
    ]);

    const streamerTasks = streamerResponse.results.map((page) => ({
      id: page.id,
      type: "streamer",
      title: page.properties.Task?.title[0]?.plain_text || "Untitled Task",
      status: page.properties.Status?.status?.name || "Not started",
    }));

    const viewerTasks = viewerResponse.results
      .map((page) => {
        const title =
          page.properties.Task?.title[0]?.plain_text || "Untitled Task";
        return {
          id: page.id,
          type: "viewer",
          title,
          submitter:
            page.properties["Suggested by"]?.rich_text[0]?.plain_text ||
            "Unknown",
          role: page.properties.Role?.select?.name || "Viewer",
          status: page.properties.Status?.status?.name || "Pending",
        };
      })
      // filter out results with prohibited content so overlay never shows harmful phrases
      .filter((t) => {
        if (containsProhibited(t.title)) {
          console.warn(
            `[EBS] Hiding prohibited viewer task from overlay: ${t.id} - ${t.title}`,
          );
          return false;
        }
        return true;
      });

    return { streamerTasks, viewerTasks };
  } catch (error) {
    // If the Notion API key is invalid, it will throw a specific error.
    // We can catch this and provide a more helpful log message.
    if (
      error.code === "unauthorized" ||
      (error.body && error.body.includes("Invalid token"))
    ) {
      console.error(
        "[NOTION] CRITICAL: The Notion API key is invalid or has expired. Please check your .env file.",
      );
      // Re-throw to ensure the caller handles the failure, which will result in a 500 error.
      throw new Error(
        "Notion API authorization failed. Please contact the site administrator.",
      );
    }
    console.error(
      "[NOTION] Failed to get tasks for overlay:",
      error.body || error,
    );
    return { streamerTasks: [], viewerTasks: [] };
  }
}

// --- Server Start ---

// Poll the Notion API until the schema updates have been applied.
// This is more reliable than a fixed delay.
async function waitForSchemaUpdate(
  notion,
  databaseId,
  expectedProps,
  timeout = 60000,
  interval = 5000,
) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    try {
      const db = await notion.databases.retrieve({ database_id: databaseId });
      const currentProps = Object.keys(db.properties);
      const hasAllProps = expectedProps.every((p) => currentProps.includes(p));
      if (hasAllProps) {
        console.log(`Schema for DB ${databaseId} is up to date.`);
        return true;
      }
    } catch (error) {
      console.warn(
        `Polling for schema update on ${databaseId} failed:`,
        error.message,
      );
    }
    await new Promise((res) => setTimeout(res, interval));
  }
  console.error(
    `Timed out waiting for schema update on DB ${databaseId} after ${
      timeout / 1000
    }s.`,
  );
  return false;
}

async function initializeServer() {
  if (STREAMER_DATABASE_ID && VIEWER_DATABASE_ID) {
    console.log("Updating database schemas...");
    await updateDatabaseSchema(notion, STREAMER_DATABASE_ID, STREAMER_SCHEMA);
    await updateDatabaseSchema(notion, VIEWER_DATABASE_ID, VIEWER_SCHEMA);

    console.log("Waiting for schema changes to apply...");
    const streamerSchemaReady = await waitForSchemaUpdate(
      notion,
      STREAMER_DATABASE_ID,
      Object.keys(STREAMER_SCHEMA.properties),
    );

    const viewerSchemaReady = await waitForSchemaUpdate(
      notion,
      VIEWER_DATABASE_ID,
      Object.keys(VIEWER_SCHEMA.properties),
    );

    console.log("Migrating existing data...");
    if (streamerSchemaReady) {
      await migrateDatabase(notion, STREAMER_DATABASE_ID, STREAMER_SCHEMA);
    } else {
      console.warn(
        "Skipping streamer DB page migration because schema update failed or timed out.",
      );
    }

    if (viewerSchemaReady) {
      await migrateDatabase(notion, VIEWER_DATABASE_ID, VIEWER_SCHEMA);
      // Ensure Approval Status is populated from existing Status values so older pages remain functional
      await fillApprovalStatusFromStatus(notion, VIEWER_DATABASE_ID);
    } else {
      console.warn(
        "Skipping viewer DB page migration because schema update failed or timed out.",
      );
    }
  }

  app.listen(PORT, () => {
    console.log(
      `[EBS] Extension Backend Service listening on http://localhost:${PORT}`,
    );
  });
}

initializeServer().catch(console.error);

// Debug-only endpoint to fetch tasks directly using env DB IDs (no auth).
// This helps debugging local setups without needing a Twitch JWT.
app.get("/_debug/tasks-local", async (req, res) => {
  try {
    const tasks = await getTasksForOverlay(
      STREAMER_DATABASE_ID,
      VIEWER_DATABASE_ID,
    );
    res.json(tasks);
  } catch (err) {
    console.error("[DEBUG] Failed to get tasks locally:", err.stack || err);
    res.status(500).json({ message: "Debug fetch failed", error: err.message });
  }
});
