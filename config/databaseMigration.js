const { Client } = require("@notionhq/client");

async function updateDatabaseSchema(notion, databaseId, schema) {
  try {
    // Get current database structure
    const database = await notion.databases.retrieve({
      database_id: databaseId,
    });

    // Collect properties to add or update
    const updates = {};
    for (const [propName, propConfig] of Object.entries(schema.properties)) {
      if (
        !database.properties[propName] ||
        database.properties[propName].type !== Object.keys(propConfig)[0]
      ) {
        updates[propName] = propConfig;
      }
    }

    // If there are properties to update, update the database
    if (Object.keys(updates).length > 0) {
      console.log(
        `Updating database ${databaseId} with new properties:`,
        Object.keys(updates),
      );
      await notion.databases.update({
        database_id: databaseId,
        properties: updates,
      });
      console.log("Database schema updated successfully");
    } else {
      console.log("Database schema is up to date");
    }

    return true;
  } catch (error) {
    console.error("Error updating database schema:", error);
    return false;
  }
}

async function migrateDatabase(notion, databaseId) {
  try {
    // Get all pages in the database
    const response = await notion.databases.query({
      database_id: databaseId,
    });

    // Add missing properties to each page
    for (const page of response.results) {
      const updates = {};

      // If Status is missing, add it as false
      if (!page.properties.Status) {
        updates.Status = { checkbox: false };
      }

      // If Approval Status is missing (for viewer tasks), add it as Pending
      if (!page.properties["Approval Status"]) {
        updates["Approval Status"] = {
          select: { name: "Pending" },
        };
      }

      // Update the page if we have changes
      if (Object.keys(updates).length > 0) {
        await notion.pages.update({
          page_id: page.id,
          properties: updates,
        });
        console.log(`Updated page ${page.id}`);
      }
    }

    return true;
  } catch (error) {
    console.error("Error migrating database:", error);
    return false;
  }
}

module.exports = {
  updateDatabaseSchema,
  migrateDatabase,
};
