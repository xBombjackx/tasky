const express = require("express");
const router = express.Router();
const { Client } = require("@notionhq/client");
const configStore = require("./configStore");
const { STREAMER_SCHEMA, VIEWER_SCHEMA } = require("./databaseSchemas");
const { STREAMER_DATABASE_ID, VIEWER_DATABASE_ID } = process.env;

// Helper function to extract page ID from Notion URL
function extractPageId(pageUrl) {
  try {
    const url = new URL(pageUrl);
    const pathParts = url.pathname.split("-");
    return pathParts[pathParts.length - 1];
  } catch (error) {
    throw new Error("Invalid Notion page URL");
  }
}

// Helper function to create databases
async function createNotionDatabases(notion, pageId) {
  try {
    const [streamerDb, viewerDb] = await Promise.all([
      notion.databases.create({
        parent: { page_id: pageId },
        title: [{ type: "text", text: { content: STREAMER_SCHEMA.name } }],
        properties: STREAMER_SCHEMA.properties,
      }),
      notion.databases.create({
        parent: { page_id: pageId },
        title: [{ type: "text", text: { content: VIEWER_SCHEMA.name } }],
        properties: VIEWER_SCHEMA.properties,
      }),
    ]);

    return {
      streamer: streamerDb.id,
      viewer: viewerDb.id,
    };
  } catch (error) {
    console.error("Error creating Notion databases:", error);
    throw new Error("Failed to create Notion databases");
  }
}

// Get setup status
router.get("/status", async (req, res) => {
  try {
    const channelId = req.twitch.channel_id;
    const status = await configStore.getSetupStatus(channelId);
    res.json(status);
  } catch (error) {
    console.error("Error getting setup status:", error);
    res.status(500).json({ error: "Failed to get setup status" });
  }
});

// Test Notion connection
router.post("/test", async (req, res) => {
  const { notionKey, pageUrl } = req.body;

  if (!notionKey || !pageUrl) {
    return res
      .status(400)
      .json({ success: false, error: "Missing required parameters" });
  }

  try {
    const notion = new Client({ auth: notionKey });
    const pageId = extractPageId(pageUrl);

    // Test if we can access the page
    await notion.pages.retrieve({ page_id: pageId });

    res.json({ success: true });
  } catch (error) {
    console.error("Connection test failed:", error);
    res.status(400).json({
      success: false,
      error:
        "Failed to connect to Notion. Please check your API key and page URL.",
    });
  }
});

// Configure the extension
router.post("/configure", async (req, res) => {
  const { notionKey, pageUrl } = req.body;
  const channelId = req.twitch.channel_id;

  if (!notionKey || !pageUrl) {
    return res
      .status(400)
      .json({ success: false, error: "Missing required parameters" });
  }

  try {
    const notion = new Client({ auth: notionKey });
    const pageId = extractPageId(pageUrl);

    // First check for existing database IDs in env
    let databases = {};
    if (STREAMER_DATABASE_ID && VIEWER_DATABASE_ID) {
      console.log("Using existing database IDs from environment variables");
      const [streamerValid, viewerValid] = await Promise.all([
        validateSchema(notion, STREAMER_DATABASE_ID, STREAMER_SCHEMA),
        validateSchema(notion, VIEWER_DATABASE_ID, VIEWER_SCHEMA),
      ]);

      if (streamerValid && viewerValid) {
        databases = {
          streamer: STREAMER_DATABASE_ID,
          viewer: VIEWER_DATABASE_ID,
        };
        console.log("Existing databases validated successfully");
      } else {
        console.log(
          "Existing databases failed validation, will search for others",
        );
      }
    }

    // If no valid databases from env, search for them
    if (!databases.streamer || !databases.viewer) {
      const streamerDbId = await findDatabaseByTitle(
        notion,
        STREAMER_SCHEMA.name,
      );
      const viewerDbId = await findDatabaseByTitle(notion, VIEWER_SCHEMA.name);

      if (streamerDbId && viewerDbId) {
        databases = { streamer: streamerDbId, viewer: viewerDbId };
        console.log("Found existing databases by title");
      } else {
        // Create new databases only if none found
        console.log("Creating new databases...");
        databases = await createNotionDatabases(notion, pageId);
      }
    } // Encrypt and save the configuration
    const encryptedKey = configStore.encryptData(notionKey);
    await configStore.updateConfig(channelId, {
      notionKey: encryptedKey,
      databases,
      setupComplete: true,
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Setup failed:", error);
    res.status(500).json({
      success: false,
      error: "Failed to complete setup. Please try again.",
    });
  }
});

module.exports = router;
