/**
 * @fileoverview A utility script to print the schema of the Notion databases.
 * It retrieves the properties of both the streamer and viewer databases and
 * logs their names, types, and options, which is useful for debugging and
 * understanding the database structure.
 */
require("dotenv").config();
const { Client } = require("@notionhq/client");

const { NOTION_API_KEY, STREAMER_DATABASE_ID, VIEWER_DATABASE_ID } =
  process.env;

if (!NOTION_API_KEY) {
  console.error("Missing NOTION_API_KEY in environment.");
  process.exit(2);
}

if (!STREAMER_DATABASE_ID && !VIEWER_DATABASE_ID) {
  console.error(
    "Please set STREAMER_DATABASE_ID and/or VIEWER_DATABASE_ID in environment.",
  );
  process.exit(2);
}

const notion = new Client({ auth: NOTION_API_KEY });

/**
 * Retrieves and prints the schema for a given Notion database.
 * @param {string} id The ID of the Notion database.
 * @param {string} label A human-readable label for the database, used in logging.
 */
async function printDb(id, label) {
  try {
    const db = await notion.databases.retrieve({ database_id: id });
    console.log(`\n--- ${label} (${id}) ---`);
    const props = db.properties || {};
    const names = Object.keys(props);
    if (names.length === 0) {
      console.log("  (no properties returned)");
      return;
    }
    for (const name of names) {
      const p = props[name];
      const type = p.type;
      console.log(`  - ${name} (type: ${type})`);
      // print a short summary of the property shape
      const summary = {};
      summary.type = type;
      if (type === "status" && p.status)
        summary.options = (p.status.options || []).map((o) => o.name);
      if (type === "select" && p.select)
        summary.options = (p.select.options || []).map((o) => o.name);
      if (type === "checkbox") summary.default = p.checkbox;
      if (type === "title") summary.title = true;
      if (type === "rich_text") summary.rich_text = true;
      console.log("    summary:", JSON.stringify(summary));
    }
  } catch (err) {
    console.error(
      `Failed to retrieve ${label} (${id}):`,
      err.body || err.message || err,
    );
  }
}

/**
 * Main function to print the schemas for the Streamer and Viewer databases.
 * It reads the database IDs from the environment variables.
 */
(async function main() {
  if (STREAMER_DATABASE_ID) {
    await printDb(STREAMER_DATABASE_ID, "Streamer DB");
  }
  if (VIEWER_DATABASE_ID) {
    await printDb(VIEWER_DATABASE_ID, "Viewer DB");
  }
})();
