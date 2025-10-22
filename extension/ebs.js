// --- Core Dependencies ---
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Client } = require("@notionhq/client");

const jwt = require("jsonwebtoken");

// --- Environment Variable Setup ---
const {
  NOTION_API_KEY,
  STREAMER_DATABASE_ID,
  VIEWER_DATABASE_ID,
  TWITCH_EXTENSION_SECRET, // IMPORTANT: We need a new secret from the Twitch Dev Console
} = process.env;

// --- Initialization ---
const app = express();
const PORT = process.env.PORT || 8081; // Extensions often use 8081 for the EBS
const notion = new Client({ auth: NOTION_API_KEY });

// --- Middleware ---
app.use(cors()); // Allow requests from the Twitch extension frontend
app.use(express.json()); // Allow the server to parse JSON request bodies

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

// --- API Endpoints for the Extension ---

// GET /tasks - Fetches all active tasks
// This endpoint is "public" in the sense that any viewer can see the tasks.
app.get("/tasks", verifyTwitchJWT, async (req, res) => {
  console.log(
    `[EBS] Received GET /tasks request from user: ${req.twitch.user_id}`,
  );
  try {
    const tasks = await getTasksForOverlay();
    res.json(tasks);
  } catch (error) {
    console.error("[EBS] CRITICAL ERROR in /tasks route:", error);
    res.status(500).json({ message: "Internal server error." });
  }
});

// POST /tasks - A viewer submits a new task
app.post("/tasks", verifyTwitchJWT, async (req, res) => {
  const { taskDescription } = req.body;
  // Use the opaque_user_id as the "username" to track who submitted it
  const submitterId = req.twitch.opaque_user_id;
  console.log(
    `[EBS] User ${submitterId} is submitting task: "${taskDescription}"`,
  );

  try {
    // Use the real function you pasted
    await addViewerTask(submitterId, taskDescription);
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
    await notion.pages.create({
      parent: { database_id: VIEWER_DATABASE_ID },
      properties: {
        Name: { title: [{ text: { content: taskDescription } }] },
        Submitter: { rich_text: [{ text: { content: username } }] },
        "Approval Status": { select: { name: "Pending" } },
        Status: { checkbox: false },
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
    const streamerDsId = await getDataSourceId(STREAMER_DATABASE_ID);
    const viewerDsId = await getDataSourceId(VIEWER_DATABASE_ID);

    if (!streamerDsId || !viewerDsId) {
      throw new Error(
        "Could not retrieve data source IDs for one or both databases.",
      );
    }

    const [streamerResponse, viewerResponse] = await Promise.all([
      notion.dataSources.query({
        data_source_id: streamerDsId,
        filter: { property: "Status", checkbox: { equals: false } },
      }),
      notion.dataSources.query({
        data_source_id: viewerDsId,
        filter: {
          and: [
            { property: "Approval Status", select: { equals: "Approved" } },
            { property: "Status", checkbox: { equals: false } },
          ],
        },
      }),
    ]);

    const streamerTasks = streamerResponse.results.map((page) => ({
      id: page.id,
      type: "streamer",
      title: page.properties.Name?.title[0]?.plain_text || "Untitled Task",
    }));

    const viewerTasks = viewerResponse.results.map((page) => ({
      id: page.id,
      type: "viewer",
      title: page.properties.Name?.title[0]?.plain_text || "Untitled Task",
      submitter:
        page.properties.Submitter?.rich_text[0]?.plain_text || "Unknown",
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
app.listen(PORT, () => {
  console.log(
    `[EBS] Extension Backend Service listening on http://localhost:${PORT}`,
  );
});
