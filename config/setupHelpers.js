const { STREAMER_SCHEMA, VIEWER_SCHEMA } = require("./databaseSchemas");
const configStore = require("./configStore");

async function validateSchema(notion, databaseId, expectedSchema) {
  try {
    const database = await notion.databases.retrieve({
      database_id: databaseId,
    });
    const currentProperties = database.properties;

    // Check if all required properties exist with correct types
    for (const [propName, propConfig] of Object.entries(
      expectedSchema.properties,
    )) {
      const currentProp = currentProperties[propName];
      if (!currentProp || currentProp.type !== Object.keys(propConfig)[0]) {
        return false;
      }
    }
    return true;
  } catch (error) {
    console.error("Error validating schema:", error);
    return false;
  }
}

async function createDatabase(notion, schema, parentPageId) {
  try {
    const response = await notion.databases.create({
      parent: { page_id: parentPageId },
      title: [{ type: "text", text: { content: schema.name } }],
      properties: schema.properties,
    });
    return response.id;
  } catch (error) {
    console.error("Error creating database:", error);
    throw error;
  }
}

async function findDatabaseByTitle(notion, title) {
  try {
    // First, try an exact title search
    let response = await notion.search({
      query: title,
      filter: {
        property: "object",
        value: "database",
      },
    });

    // Check for exact match first
    let match = response.results.find(
      (db) => db.title[0]?.plain_text === title,
    );
    if (match) {
      console.log(`Found existing database: ${title}`);
      return match.id;
    }

    // If no exact match, try a broader search
    response = await notion.search({
      query: title,
      filter: {
        property: "object",
        value: "database",
      },
      page_size: 100,
    });
    return (
      response.results.find((db) => db.title[0]?.plain_text === title)?.id ||
      null
    );
  } catch (error) {
    console.error("Error searching for database:", error);
    return null;
  }
}

module.exports = {
  validateSchema,
  createDatabase,
  findDatabaseByTitle,
};
