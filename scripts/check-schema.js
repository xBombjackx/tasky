/**
 * @fileoverview A debug script to check and print the current schema of the
 * Streamer and Viewer Notion databases. This helps in verifying that the
 * database structure matches the expected schema defined in the application.
 */
const { Client } = require("@notionhq/client");
require("dotenv").config();

const notion = new Client({ auth: process.env.NOTION_API_KEY });

/**
 * Retrieves and logs the structure of the Streamer and Viewer databases.
 * This is useful for debugging schema issues.
 */
async function checkDatabaseStructure() {
  try {
    console.log("Checking Streamer Database structure...");
    const streamerDb = await notion.databases.retrieve({
      database_id: process.env.STREAMER_DATABASE_ID,
    });
    console.log("\nStreamer Database Properties:");
    console.log(JSON.stringify(streamerDb.properties, null, 2));

    console.log("\nChecking Viewer Database structure...");
    const viewerDb = await notion.databases.retrieve({
      database_id: process.env.VIEWER_DATABASE_ID,
    });
    console.log("\nViewer Database Properties:");
    console.log(JSON.stringify(viewerDb.properties, null, 2));
  } catch (error) {
    console.error("Error:", error);
  }
}

checkDatabaseStructure();
