// --- Core Dependencies ---
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Client } = require("@notionhq/client");
const jwt = require("jsonwebtoken");

// --- Local Dependencies ---
const configStore = require("./config/configStore");
const setupRoutes = require("./config/setupRoutes");
const {
  updateDatabaseSchema,
  migrateDatabase,
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

    // Save database IDs to config
    await configManager.updateDatabases(streamerDbId, viewerDbId);

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

// GET /tasks - Fetches all active tasks
// This endpoint is "public" in the sense that any viewer can see the tasks.
app.get("/tasks", verifyTwitchJWT, async (req, res) => {
  const channelId = req.twitch.channel_id;
  console.log(
    `[EBS] Received GET /tasks request from user: ${req.twitch.user_id} for channel: ${channelId}`,
  );
  try {
    const tasks = await getTasksForOverlay(channelId);
    res.json(tasks);
  } catch (error) {
    console.error("[EBS] CRITICAL ERROR in /tasks route:", error);
    res.status(500).json({ message: "Internal server error." });
  }
});

// POST /tasks - A viewer submits a new task
app.post("/tasks", verifyTwitchJWT, async (req, res) => {
  const { taskDescription } = req.body;
  const channelId = req.twitch.channel_id;
  // Use the opaque_user_id as the "username" to track who submitted it
  const submitterId = req.twitch.opaque_user_id;
  console.log(
    `[EBS] User ${submitterId} is submitting task: "${taskDescription}" for channel: ${channelId}`,
  );

  try {
    await addViewerTask(channelId, submitterId, taskDescription);
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
// --- Notion Helper Functions ---

const dataSourceCache = new Map();

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

async function findUserTask(username, approvalStatus) {
  const dataSourceId = await getDataSourceId(VIEWER_DATABASE_ID);
  if (!dataSourceId) return null;
  try {
    const response = await notion.dataSources.query({
      data_source_id: dataSourceId,
      filter: {
        and: [
          { property: "Submitter", rich_text: { equals: username } },
          { property: "Approval Status", select: { equals: approvalStatus } },
        ],
      },
    });
    return response.results.length > 0 ? response.results[0] : null;
  } catch (error) {
    console.error(
      `[NOTION] Error finding task for ${username}:`,
      error.body || error,
    );
    return null;
  }
}

async function addViewerTask(username, taskDescription) {
  try {
    if (!VIEWER_DATABASE_ID) {
      throw new Error("Viewer database ID not found in environment variables.");
    }
    await notion.pages.create({
      parent: { database_id: VIEWER_DATABASE_ID },
      properties: {
        Task: { title: [{ text: { content: taskDescription } }] },
        "Suggested by": { rich_text: [{ text: { content: username } }] },
        Status: { status: { name: "Pending" } },
        Completed: { checkbox: false },
        Role: { select: { name: "Viewer" } },
      },
    });
    console.log(`[NOTION] Added task for ${username}: "${taskDescription}"`);
  } catch (error) {
    console.error("[NOTION] Error adding task:", error.body || error);
  }
}

async function approveViewerTask(username) {
  const task = await findUserTask(username, "Pending");
  if (task) {
    await notion.pages.update({
      page_id: task.id,
      properties: { "Approval Status": { select: { name: "Approved" } } },
    });
    console.log(`[NOTION] Approved task for ${username}`);
    return `Task for @${username} has been approved!`;
  }
  return `No pending task found for @${username}.`;
}

async function rejectViewerTask(username) {
  const task = await findUserTask(username, "Pending");
  if (task) {
    await notion.pages.update({ page_id: task.id, archived: true });
    console.log(`[NOTION] Rejected (archived) task for ${username}`);
    return `Task for @${username} has been rejected.`;
  }
  return `No pending task found for @${username} to reject.`;
}

async function updateViewerTaskStatus(username, isComplete) {
  const task = await findUserTask(username, "Approved");
  if (task) {
    await notion.pages.update({
      page_id: task.id,
      properties: { Status: { checkbox: isComplete } },
    });
    const statusText = isComplete ? "completed" : "reset to active";
    console.log(`[NOTION] Task for ${username} marked as ${statusText}`);
    return `@${username}'s task has been marked as ${statusText}!`;
  }
  return `@${username}, no active task found for you to update.`;
}

async function getTasksForOverlay() {
  try {
    // Use environment variables directly if available
    const streamerDbId = STREAMER_DATABASE_ID;
    const viewerDbId = VIEWER_DATABASE_ID;

    if (!streamerDbId || !viewerDbId) {
      throw new Error("Database IDs not found in environment variables.");
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
      state: page.properties.State?.status?.name || "Not started",
    }));

    const viewerTasks = viewerResponse.results.map((page) => ({
      id: page.id,
      type: "viewer",
      title: page.properties.Task?.title[0]?.plain_text || "Untitled Task",
      submitter:
        page.properties["Suggested by"]?.rich_text[0]?.plain_text || "Unknown",
      role: page.properties.Role?.select?.name || "Viewer",
      status: page.properties.Status?.status?.name || "Pending",
    }));

    return { streamerTasks, viewerTasks };
  } catch (error) {
    console.error(
      "[NOTION] Failed to get tasks for overlay:",
      error.body || error,
    );
    return { streamerTasks: [], viewerTasks: [] };
  }
}

// --- Server Start ---
async function initializeServer() {
  if (STREAMER_DATABASE_ID && VIEWER_DATABASE_ID) {
    console.log("Updating database schemas...");
    await updateDatabaseSchema(notion, STREAMER_DATABASE_ID, STREAMER_SCHEMA);
    await updateDatabaseSchema(notion, VIEWER_DATABASE_ID, VIEWER_SCHEMA);

    console.log("Migrating existing data...");
    await migrateDatabase(notion, STREAMER_DATABASE_ID);
    await migrateDatabase(notion, VIEWER_DATABASE_ID);
  }

  app.listen(PORT, () => {
    console.log(
      `[EBS] Extension Backend Service listening on http://localhost:${PORT}`,
    );
  });
}

initializeServer().catch(console.error);
