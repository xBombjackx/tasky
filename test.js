// Use require('dotenv').config() to load the .env file
require('dotenv').config();

// Import the Notion SDK client
// Make sure to import isFullDatabase for type checking
const { Client, isFullDatabase } = require('@notionhq/client');

// Get your environment variables using the updated names
const notionApiKey = process.env.NOTION_API_KEY;
// Use the more accurate variable name for the Database ID
const streamerDatabaseId = process.env.STREAMER_DATABASE_ID;
// Load the Viewer Database ID
const viewerDatabaseId = process.env.VIEWER_DATABASE_ID;

// Check if variables are loaded
if (!notionApiKey || !streamerDatabaseId || !viewerDatabaseId) { // Check both IDs
  console.error(
    'Error: Missing NOTION_API_KEY, STREAMER_DATABASE_ID, or VIEWER_DATABASE_ID in your .env file'
  );
  process.exit(1);
}

// Initialize the Notion client
const notion = new Client({ auth: notionApiKey });

/**
 * Retrieves a database, finds its data source ID, queries it, and logs task names.
 * @param {string} databaseId - The ID of the Notion database to query.
 * @param {string} databaseName - A descriptive name for the database (for logging).
 */
async function queryAndLogTasks(databaseId, databaseName) {
  console.log(`\n--- Processing "${databaseName}" (Database ID: ${databaseId}) ---`);

  // 1. Retrieve the database object using the database_id
  console.log(`Retrieving database...`);
  const databaseResponse = await notion.databases.retrieve({
    database_id: databaseId,
  });

  // Check if the response is a full database object and has data sources
  if (!isFullDatabase(databaseResponse) || !databaseResponse.data_sources || databaseResponse.data_sources.length === 0) {
    console.error(`Error: Could not retrieve data source information for database "${databaseName}" (ID: ${databaseId}).`);
    console.error('Ensure the integration has access to the database and the ID is correct.');
    return; // Skip this database if we can't get the data source
  }

  // 2. Get the first data_source_id from the response
  const dataSourceId = databaseResponse.data_sources[0].id; // Extract the data source ID
  console.log(`Successfully retrieved Data Source ID: ${dataSourceId}`);

  // 3. Query the data source using the retrieved data_source_id
  console.log('Querying the data source...');
  const queryResponse = await notion.dataSources.query({
    data_source_id: dataSourceId, // Use the extracted data_source_id
  });

  console.log('Success! Connected and queried data source.');
  console.log('---------------------------------');

  // 4. Log the results
  console.log(`Found ${queryResponse.results.length} tasks in "${databaseName}":`);

  // 5. Loop through and print task names (adjust property name if needed)
  if (queryResponse.results.length === 0) {
    console.log("No tasks found.");
  } else {
    queryResponse.results.forEach((page) => {
      // Ensure it's a page object with properties
      if (page.object === 'page' && 'properties' in page) {
        // *** IMPORTANT: Change "Name" if your title property has a different name ***
        const titlePropertyName = "Name"; // Default name, adjust if necessary for each DB

        const titleProperty = page.properties[titlePropertyName];

        // Check if the property exists, is of type 'title', and has plain_text content
        if (titleProperty && titleProperty.type === 'title' && titleProperty.title[0]?.plain_text) {
          console.log(`- ${titleProperty.title[0].plain_text}`);
        } else if (titleProperty && titleProperty.type === 'title') {
           console.log("- Task found, but the title property is empty.");
        } else {
          console.log(`- Task found, but property named "${titlePropertyName}" of type "title" was not found or is empty.`);
          // Optional: Log properties to debug if name is wrong
          // console.log("Page properties:", JSON.stringify(page.properties, null, 2));
        }
      } else {
        console.log("- Found an item that is not a full page object");
      }
    });
  }
}

// Define the main async function to run queries for both databases
async function runAllQueries() {
  console.log('Connecting to Notion...');

  try {
    // Query the Streamer Tasks database
    await queryAndLogTasks(streamerDatabaseId, "Streamer Tasks");

    // Query the Viewer Tasks database
    await queryAndLogTasks(viewerDatabaseId, "Viewer Tasks");

  } catch (error) {
    // General error handling for issues outside the specific query function (e.g., initial connection)
    console.error('\nError during Notion operation:');
    if (error.code && error.message) { // Check if it's likely a NotionClientError
        console.error(`Code: ${error.code}`);
        console.error(`Message: ${error.message}`);
        if (error.body) {
             console.error(`Body: ${error.body}`);
        }
    } else { // Log generic errors
        console.error(error.message || error);
    }
  }
}

// Run the main function
runAllQueries();