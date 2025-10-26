require("dotenv").config();
const { Client } = require("@notionhq/client");

const { NOTION_API_KEY, STREAMER_DATABASE_ID, VIEWER_DATABASE_ID } =
  process.env;
if (!NOTION_API_KEY) {
  console.error("Missing NOTION_API_KEY");
  process.exit(2);
}
const notion = new Client({ auth: NOTION_API_KEY });

async function run() {
  try {
    console.log("Querying streamer DB", STREAMER_DATABASE_ID);
    const streamerResponse = await notion.databases.query({
      database_id: STREAMER_DATABASE_ID,
      filter: { property: "Completed", checkbox: { equals: false } },
    });
    console.log("Streamer results:", streamerResponse.results.length);

    console.log("Querying viewer DB", VIEWER_DATABASE_ID);
    const viewerResponse = await notion.databases.query({
      database_id: VIEWER_DATABASE_ID,
      filter: {
        and: [
          { property: "Status", status: { equals: "Approved" } },
          { property: "Completed", checkbox: { equals: false } },
        ],
      },
    });
    console.log("Viewer results:", viewerResponse.results.length);

    console.log(
      "First streamer page sample:",
      JSON.stringify(streamerResponse.results[0]?.properties, null, 2),
    );
    console.log(
      "First viewer page sample:",
      JSON.stringify(viewerResponse.results[0]?.properties, null, 2),
    );
  } catch (err) {
    console.error("Error querying Notion:", err.body || err);
  }
}

run();
