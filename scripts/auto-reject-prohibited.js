require("dotenv").config();
const { Client } = require("@notionhq/client");

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const VIEWER_DATABASE_ID = process.env.VIEWER_DATABASE_ID;

if (!NOTION_API_KEY) {
  console.error("Missing NOTION_API_KEY");
  process.exit(2);
}
if (!VIEWER_DATABASE_ID) {
  console.error("Missing VIEWER_DATABASE_ID");
  process.exit(2);
}

const notion = new Client({ auth: NOTION_API_KEY });

const PROHIBITED_PATTERNS = [
  /kill\s+yourself/i,
  /kill\s+your\s+self/i,
  /suicid/i,
  /die\s+yourself/i,
  /go\s+die/i,
];

function containsProhibited(text) {
  if (!text || typeof text !== "string") return false;
  for (const rx of PROHIBITED_PATTERNS) if (rx.test(text)) return true;
  return false;
}

(async function main() {
  try {
    const resp = await notion.databases.query({
      database_id: VIEWER_DATABASE_ID,
    });
    console.log(`Found ${resp.results.length} pages in viewer DB`);
    let count = 0;
    for (const page of resp.results) {
      const title = page.properties.Task?.title[0]?.plain_text || "";
      if (containsProhibited(title)) {
        console.log(`Rejecting page ${page.id}: ${title}`);
        try {
          await notion.pages.update({
            page_id: page.id,
            archived: true,
            properties: { "Approval Status": { select: { name: "Rejected" } } },
          });
          count++;
        } catch (err) {
          console.error(
            `Failed to reject ${page.id}:`,
            err.body || err.message || err,
          );
        }
      }
    }
    console.log(`Done. Rejected ${count} pages.`);
  } catch (err) {
    console.error("Error querying viewer DB:", err.body || err.message || err);
    process.exit(1);
  }
})();
