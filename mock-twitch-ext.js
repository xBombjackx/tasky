// mock-twitch-ext.js
window.Twitch = {
  ext: {
    // --- Mock Configuration Service ---
    configuration: {
      broadcaster: {
        content: "{}", // Start with empty config
      },
      set: function (segment, version, content) {
        console.log("Mock Twitch: configuration.set() called.");
        console.log("  - Segment:", segment);
        console.log("  - Version:", version);
        console.log("  - Content:", content);
        // In a real scenario, this would be saved. For the mock, we can just
        // update the local object if we want to simulate persistence.
        if (segment === "broadcaster") {
          window.Twitch.ext.configuration.broadcaster.content = content;
        }
      },
    },

    // --- Mock Authorization ---
    onAuthorized: async function (callback) {
      console.log("Mock Twitch: onAuthorized() called.");
      try {
        // Get role from URL for testing, e.g., code.html?local=true&role=vip
        const urlParams = new URLSearchParams(window.location.search);
        const role = urlParams.get("role") || "broadcaster"; // Default to broadcaster for config page

        // Fetch a valid, signed JWT from our mock EBS
        const response = await fetch(
          `http://localhost:8082/mock-jwt?role=${role}`,
        );
        const { token } = await response.json();

        callback({
          token: token,
          userId: "123456789",
          channelId: "987654321",
        });
      } catch (error) {
        console.error("Mock Twitch Error: Could not fetch mock JWT.", error);
      }
    },

    // --- Mock Context ---
    onContext: function (callback) {
      // Mock onContext if needed, otherwise leave empty
      console.log("Mock Twitch: onContext() called.");
    },

    // --- Mock Visibility ---
    onVisibilityChanged: function (callback) {
      console.log("Mock Twitch: onVisibilityChanged() called.");
      // For local testing, we can assume the extension is always visible.
      callback(true);
    },
  },
};
