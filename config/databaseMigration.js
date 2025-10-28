const { Client } = require("@notionhq/client");

/**
 * Ensure a Notion database's properties match the provided schema.
 *
 * If a property is missing or has a different type, the function adds or replaces it.
 * For `status` properties, it first creates them with an empty `status` object (to satisfy API constraints)
 * and then applies their status options in a second update.
 *
 * @param {string} databaseId - The Notion database ID to update.
 * @param {Object} schema - Schema object containing a `properties` map of Notion property definitions to apply.
 * @returns {boolean} `true` if the schema update completed successfully, `false` on error.
 */
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
        const newPropConfig = JSON.parse(JSON.stringify(propConfig));
        // When creating a status property via databases.update, the API
        // rejects requests that include options or groups.
        // The property must be created with an empty status object first.
        if (newPropConfig.status) {
          newPropConfig.status = {};
        }
        updates[propName] = newPropConfig;
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
      console.log("Database properties created successfully");

      // Now, update status properties with their options since they must be created empty first
      const statusUpdates = {};
      for (const propName of Object.keys(updates)) {
        if (schema.properties[propName].status) {
          statusUpdates[propName] = schema.properties[propName];
        }
      }

      if (Object.keys(statusUpdates).length > 0) {
        console.log(
          `Updating status options for properties:`,
          Object.keys(statusUpdates),
        );
        await notion.databases.update({
          database_id: databaseId,
          properties: statusUpdates,
        });
        console.log("Status properties updated with options successfully");
      }
    } else {
      console.log("Database schema is up to date");
    }

    return true;
  } catch (error) {
    console.error("Error updating database schema:", error);
    return false;
  }
}

async function migrateDatabase(notion, databaseId, schema) {
  try {
    // Retrieve current database structure so we can be sure properties exist
    const database = await notion.databases.retrieve({
      database_id: databaseId,
    });

    // If the database doesn't have the properties defined by the schema,
    // skip page-level migrations — the schema update should have added them.
    const missingProps = Object.keys(schema.properties).filter(
      (p) => !database.properties[p],
    );
    if (missingProps.length > 0) {
      console.warn(
        `Database ${databaseId} is missing properties: ${missingProps.join(", ")}. ` +
          "Skipping page-level migration until schema is applied.",
      );
      return false;
    }

    // Get all pages in the database
    const response = await notion.databases.query({
      database_id: databaseId,
    });

    // Add missing properties to each page according to the provided schema
    for (const page of response.results) {
      const updates = {};

      for (const [propName, propConfig] of Object.entries(schema.properties)) {
        if (!page.properties[propName]) {
          const propType = Object.keys(propConfig)[0];
          switch (propType) {
            case "checkbox":
              updates[propName] = { checkbox: false };
              break;
            case "status": {
              // Prefer a sensible default if present in schema options
              const opts = propConfig.status && propConfig.status.options;
              const defaultName =
                (opts && opts.find((o) => o.name === "Pending")?.name) ||
                (opts && opts[0] && opts[0].name) ||
                "Not started";
              updates[propName] = { status: { name: defaultName } };
              break;
            }
            case "select": {
              const opts = propConfig.select && propConfig.select.options;
              const defaultName =
                (opts && opts[0] && opts[0].name) || "Default";
              updates[propName] = { select: { name: defaultName } };
              break;
            }
            // For title/rich_text/etc. we generally skip page-level defaults
            default:
              break;
          }
        }
      }

      // Update the page if we have changes
      if (Object.keys(updates).length > 0) {
        try {
          await notion.pages.update({
            page_id: page.id,
            properties: updates,
          });
          console.log(`Updated page ${page.id}`);
        } catch (pageErr) {
          // Log and continue — don't let one page break the whole migration
          console.error(
            `Failed to update page ${page.id} in DB ${databaseId}:`,
            pageErr.body || pageErr,
          );
        }
      }
    }

    return true;
  } catch (error) {
    console.error("Error migrating database:", error);
    return false;
  }
}

async function fillApprovalStatusFromStatus(notion, databaseId) {
  try {
    const response = await notion.databases.query({ database_id: databaseId });
    let updated = 0;
    for (const page of response.results) {
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
          updated++;
        } catch (err) {
          console.error(
            `Failed to update Approval Status for page ${page.id}:`,
            err.body || err,
          );
        }
      }
    }
    console.log(
      `fillApprovalStatusFromStatus: updated ${updated} pages in DB ${databaseId}`,
    );
    return true;
  } catch (err) {
    console.error("Error in fillApprovalStatusFromStatus:", err.body || err);
    return false;
  }
}

module.exports = {
  updateDatabaseSchema,
  migrateDatabase,
  fillApprovalStatusFromStatus,
};