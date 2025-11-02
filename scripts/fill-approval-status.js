/**
 * @fileoverview A one-time migration script to populate the "Approval Status"
 * property in the viewer database. It infers the approval status from the
 * existing "Status" property to ensure backward compatibility for tasks
 * created before the moderation system was introduced.
 */
require("dotenv").config();
const { Client } = require("@notionhq/client");

const { NOTION_API_KEY, VIEWER_DATABASE_ID } = process.env;
if (!NOTION_API_KEY) {
  console.error("Missing NOTION_API_KEY");
  process.exit(2);
}
if (!VIEWER_DATABASE_ID) {
  console.error("Missing VIEWER_DATABASE_ID");
  process.exit(2);
}

const notion = new Client({ auth: NOTION_API_KEY });

/**
 * One-time script to backfill the "Approval Status" property for existing pages
 * in the viewer database. It takes the value from the "Status" property if
 * "Approval Status" is not set. This ensures older entries work with the new
 * moderation system.
 */
async function run() {
  try {
    const resp = await notion.databases.query({
      database_id: VIEWER_DATABASE_ID,
    });
    console.log(`Found ${resp.results.length} pages in viewer DB`);
    let updated = 0;
    for (const page of resp.results) {
      const approval = page.properties["Approval Status"]?.select;
      const status = page.properties["Status"]?.status?.name;
      if (!approval && status) {
        const mapped = ["Pending", "Approved", "Rejected"].includes(status)
          ? status
          : "Pending";
        try {
          await notion.pages.update({
            page_id: page.id,
            properties: { "Approval Status": { select: { name: mapped } } },
          });
          console.log(`Updated page ${page.id} Approval Status -> ${mapped}`);
          updated++;
        } catch (err) {
          console.error(
            `Failed to update page ${page.id}:`,
            err.body || err.message || err,
          );
        }
      }
    }
    console.log(`Done. Updated ${updated} pages.`);
  } catch (err) {
    console.error("Failed to query viewer DB:", err.body || err.message || err);
  }
}

run();
