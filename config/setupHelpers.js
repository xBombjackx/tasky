/**
 * @fileoverview Helper functions for setting up and validating Notion databases.
 * This module provides functions to create, find, and validate the schemas
 * of Notion databases used by the extension.
 */
const { STREAMER_SCHEMA, VIEWER_SCHEMA } = require("./databaseSchemas");

/**
 * Verify that a Notion database's properties match the expected schema.
 *
 * @param {string} databaseId - The Notion database ID to validate.
 * @param {Object} expectedSchema - Schema object containing a `properties` map where each key is a property name and each value is a property config object whose primary key is the expected property type (e.g., `{ "Title": { "title": {} } }`).
 * @returns {boolean} `true` if every property in `expectedSchema.properties` exists in the database and has the same type; `false` otherwise (also returns `false` on retrieval errors).
 */
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

/**
 * Create a Notion database from the provided schema under the specified parent page.
 *
 * Properties in the schema that include a `status` field are applied in a follow-up update after the initial create.
 * @param {object} notion - Notion SDK client used to call the Notion API.
 * @param {object} schema - Schema object containing `name` and `properties` used to build the database.
 * @param {string} parentPageId - ID of the parent page under which the database will be created.
 * @returns {string} The ID of the created database.
 * @throws {Error} If an error occurs while creating or updating the database; the original error is rethrown.
 */
async function createDatabase(notion, schema, parentPageId) {
  const propertiesForCreate = JSON.parse(JSON.stringify(schema.properties));
  const statusProperties = {};

  for (const propName in propertiesForCreate) {
    if (propertiesForCreate[propName].hasOwnProperty("status")) {
      statusProperties[propName] = propertiesForCreate[propName];
      delete propertiesForCreate[propName];
    }
  }

  try {
    const response = await notion.databases.create({
      parent: { page_id: parentPageId },
      is_inline: true,
      title: [{ type: "text", text: { content: schema.name } }],
      properties: propertiesForCreate,
    });

    if (Object.keys(statusProperties).length > 0) {
      await notion.databases.update({
        database_id: response.id,
        properties: statusProperties,
      });
    }

    return response.id;
  } catch (error) {
    console.error("Error creating database:", error);
    throw error;
  }
}

/**
 * Searches for a Notion database by its exact title.
 * @param {object} notion - The Notion SDK client.
 * @param {string} title - The exact title of the database to find.
 * @returns {string|null} The ID of the found database, or null if not found.
 * @throws {Error} If the Notion API search fails.
 */
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