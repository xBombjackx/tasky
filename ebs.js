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
    // This is a placeholder for the actual Twitch Configuration Service call
    console.log(`Saving to Twitch Config Service: streamerDbId=${streamerDbId}, viewerDbId=${viewerDbId}`);

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

const fetch = require("node-fetch");

// GET /config - Fetches the extension's configuration
app.get("/config", verifyTwitchJWT, async (req, res) => {
  const { channel_id: channelId, user_id: userId } = req.twitch;
  const url = `https://api.twitch.tv/extensions/${process.env.TWITCH_CLIENT_ID}/configurations/segments/broadcaster`;

  const token = jwt.sign(
    {
      exp: Math.floor(Date.now() / 1000) + 60,
      user_id: userId,
      role: "external",
      channel_id: channelId,
    },
    Buffer.from(process.env.TWITCH_EXTENSION_SECRET, "base64")
  );

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Client-ID": process.env.TWITCH_CLIENT_ID,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (response.ok) {
      const data = await response.json();
      const config = JSON.parse(data[0].content);
      res.json(config);
    } else {
      res.status(response.status).json({ message: "Failed to fetch configuration." });
    }
  } catch (error) {
    console.error("Error fetching configuration:", error);
    res.status(500).json({ message: "Internal server error." });
  }
});

// GET /tasks - Fetches all active tasks
// This endpoint is "public" in the sense that any viewer can see the tasks.
app.get("/tasks", verifyTwitchJWT, async (req, res) => {
  const channelId = req.twitch.channel_id;
  console.log(
    `[EBS] Received GET /tasks request from user: ${req.twitch.user_id} for channel: ${channelId}`,
  );
  try {
    const configResponse = await fetch(`http://localhost:${PORT}/config`, {
      headers: {
        Authorization: req.headers.authorization,
      },
    });

    if (!configResponse.ok) {
      throw new Error("Failed to fetch configuration for tasks.");
    }

    const config = await configResponse.json();
    const { streamerDbId, viewerDbId } = config;

    const tasks = await getTasksForOverlay(streamerDbId, viewerDbId);
    res.json(tasks);
  } catch (error) {
    console.error("[EBS] CRITICAL ERROR in /tasks route:", error);
    res.status(500).json({ message: "Internal server error." });
  }
});

// POST /tasks - A viewer submits a new task
app.post("/tasks", verifyTwitchJWT, async (req, res) => {
  const { taskDescription } = req.body;

  if (!taskDescription || taskDescription.trim().length === 0) {
    return res.status(400).json({ message: "Task description cannot be empty." });
  }

  const channelId = req.twitch.channel_id;
  // Use the opaque_user_id as the "username" to track who submitted it
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

async function findUserTask(opaque_user_id, approvalStatus) {
  const dataSourceId = await getDataSourceId(VIEWER_DATABASE_ID);
  if (!dataSourceId) return null;
  try {
    const response = await notion.dataSources.query({
      data_source_id: dataSourceId,
      filter: {
        and: [
          { property: "Suggested by", rich_text: { equals: opaque_user_id } },
          { property: "Approval Status", select: { equals: approvalStatus } },
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
        Completed: { checkbox: false },
        Role: { select: { name: "Viewer" } },
      },
    });
    console.log(`[NOTION] Added task for ${opaque_user_id}: "${taskDescription}"`);
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
      properties: { Status: { checkbox: isComplete } },
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
