const { Client } = require("@notionhq/client");
require("dotenv").config();

const notion = new Client({ auth: process.env.NOTION_API_KEY });

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
