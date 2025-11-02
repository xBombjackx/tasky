/**
 * @fileoverview Configuration script for the Twitch Extension.
 * This file handles the logic for the configuration page, including saving
 * settings to the Twitch Configuration Service and setting up Notion databases.
 */

/**
 * Twitch Extension onAuthorized callback.
 * This function is called when the extension is authorized. It retrieves the
 * broadcaster's configuration, populates the form fields, and fetches pending tasks.
 * @param {object} auth - The Twitch authentication object.
 * @param {string} auth.token - The JWT token for authentication with the EBS.
 */
window.Twitch.ext.onAuthorized(function (auth) {
  // Store auth token for later use by other functions
  window.twitchAuth = auth;

  // The broadcaster's configuration is available in the `configuration` object.
  const configStr =
    window.Twitch.ext.configuration &&
    window.Twitch.ext.configuration.broadcaster
      ? window.Twitch.ext.configuration.broadcaster.content
      : "{}";

  try {
    const config = JSON.parse(configStr);
    if (config.streamerDbId) {
      document.getElementById("streamerDbId").value = config.streamerDbId;
    }
    if (config.viewerDbId) {
      document.getElementById("viewerDbId").value = config.viewerDbId;
    }
  } catch (e) {
    console.error("Error parsing configuration:", e);
  }

  // Fetch pending tasks now that we are authorized.
  // This function is defined in the inline script on config.html
  if (typeof fetchPendingTasks === "function") {
    fetchPendingTasks();
  } else {
    console.error("fetchPendingTasks() function not found.");
  }
});

/**
 * Saves the configuration to the Twitch Configuration Service.
 * This function is called when the "Save Configuration" button is clicked.
 */
function saveConfiguration() {
  const streamerDbId = document.getElementById("streamerDbId").value;
  const viewerDbId = document.getElementById("viewerDbId").value;

  window.Twitch.ext.configuration.set(
    "broadcaster",
    "1", // content version
    JSON.stringify({
      streamerDbId: streamerDbId,
      viewerDbId: viewerDbId,
    }),
  );
}

/**
 * Creates the Notion databases required for the extension.
 * This function is called when the "Create Databases" button is clicked.
 * It sends a request to the EBS to create the databases and then saves
 * the new database IDs to the configuration.
 */
function createDatabases() {
  const userInput = document.getElementById("parentPageId").value.trim();
  const statusEl = document.getElementById("setup-status");
  let parentPageId = userInput;

  if (userInput.startsWith("http")) {
    try {
      const url = new URL(userInput);
      const path = url.pathname;
      const id = path.substring(path.lastIndexOf("-") + 1);
      if (id && id.length === 32) {
        parentPageId = id;
      } else {
        throw new Error("Could not find a valid 32-character ID in the URL.");
      }
    } catch (e) {
      statusEl.textContent = `Error: ${e.message}`;
      statusEl.className = "text-sm mt-4 text-red-400";
      return;
    }
  }

  if (!parentPageId) {
    statusEl.textContent = "Please enter a valid Notion Page ID or URL.";
    statusEl.className = "text-sm mt-4 text-red-400";
    return;
  }

  // Disable button and show status
  const createBtn = document.getElementById("create-dbs");
  createBtn.disabled = true;
  createBtn.textContent = "Creating...";
  statusEl.textContent = "Creating databases, please wait...";
  statusEl.className = "text-sm mt-4 text-yellow-400";

  const url = new URL(window.location.href);
  const isLocal = url.searchParams.get("local") === "true";
  const ebsUrl = isLocal ? "http://localhost:8081" : EBS_URL;

  fetch(`${ebsUrl}/setup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Use the stored token from onAuthorized
      Authorization: `Bearer ${window.twitchAuth.token}`,
    },
    body: JSON.stringify({ parentPageId: parentPageId }),
  })
    .then((response) => {
      if (!response.ok) {
        // Throw an error to be caught by the catch block, including server message
        return response
          .json()
          .then((err) => {
            throw new Error(err.message || "Setup failed with no error message.");
          })
          .catch(() => {
            throw new Error(`Setup failed with status: ${response.status}`);
          });
      }
      return response.json();
    })
    .then((data) => {
      statusEl.textContent =
        "Databases created successfully! Saving configuration...";
      statusEl.className = "text-sm mt-4 text-green-400";

      // Populate the fields with the new IDs
      document.getElementById("streamerDbId").value = data.databases.streamer.id;
      document.getElementById("viewerDbId").value = data.databases.viewer.id;

      // Automatically save the new configuration
      saveConfiguration();

      // Let user know save is complete
      setTimeout(() => {
        statusEl.textContent =
          "Setup complete! Your configuration has been saved.";
      }, 1000);
    })
    .catch((error) => {
      console.error("Setup Error:", error);
      statusEl.textContent = `Error: ${error.message}`;
      statusEl.className = "text-sm mt-4 text-red-400";
    })
    .finally(() => {
      // Re-enable button
      createBtn.disabled = false;
      createBtn.textContent = "Create Databases";
    });
}
