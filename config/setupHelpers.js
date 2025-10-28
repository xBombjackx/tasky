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
  // Deep copy the properties to avoid modifying the original schema object
  const propertiesForCreate = JSON.parse(JSON.stringify(schema.properties));

  // The Notion API has a two-step process for creating status properties.
  // First, create the database WITHOUT the status property.
  // Then, an update call is needed to add the status property with its options.
  // This logic removes status properties from the initial create call.
  for (const propName in propertiesForCreate) {
    if (propertiesForCreate[propName].hasOwnProperty("status")) {
      delete propertiesForCreate[propName];
    }
  }

  try {
    const response = await notion.databases.create({
      parent: { page_id: parentPageId },
      is_inline: true,
      title: [{ type: "text", text: { content: schema.name } }],
      properties: propertiesForCreate, // Use the modified properties
    });
    return response.id;
  } catch (error) {
    console.error("Error creating database:", error);
    throw error;
  }
}

async function findDatabaseByTitle(notion, title) {
  try {
    const response = await notion.search({
      query: title,
      filter: {
        property: "object",
        value: "database",
      },
      page_size: 10,
    });

    const match = response.results.find(
      (db) => db.title[0]?.plain_text === title,
    );

    if (match) {
      console.log(`Found existing database by title '${title}': ${match.id}`);
      return match.id;
    }

    return null;
  } catch (error) {
    console.error(`Error searching for database by title '${title}':`, error);
    // Re-throw the error so the calling function knows the search failed,
    // rather than assuming the database doesn't exist. This is critical
    // for stopping the setup process if the Notion API key is invalid.
    throw error;
  }
}

module.exports = {
  validateSchema,
  createDatabase,
  findDatabaseByTitle,
};
