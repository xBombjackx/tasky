/**
 * @fileoverview Mock implementation of the Twitch Extension Helper library.
 * This file simulates the `window.Twitch.ext` object for local development
 * and testing. It provides mock functions for authorization, configuration,
 * and other Twitch services, allowing the frontend to run without being
 * embedded in the actual Twitch platform.
 */
window.Twitch = {
  ext: {
    // --- Mock Configuration Service ---
    configuration: {
      broadcaster: {
        content: "{}", // Start with empty config
      },
      /**
       * Mock for the Twitch Extension Configuration Service set function.
       * @param {string} segment - The configuration segment to set.
       * @param {string} version - The version of the configuration.
       * @param {string} content - The content to set.
       */
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
    /**
     * Mock for the Twitch Extension onAuthorized callback.
     * @param {function} callback - The callback function to call with the auth object.
     */
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
    /**
     * Mock for the Twitch Extension onContext callback.
     * @param {function} callback - The callback function to call with the context object.
     */
    onContext: function (callback) {
      // Mock onContext if needed, otherwise leave empty
      console.log("Mock Twitch: onContext() called.");
    },

    // --- Mock Visibility ---
    /**
     * Mock for the Twitch Extension onVisibilityChanged callback.
     * @param {function} callback - The callback function to call with the visibility state.
     */
    onVisibilityChanged: function (callback) {
      console.log("Mock Twitch: onVisibilityChanged() called.");
      // For local testing, we can assume the extension is always visible.
      callback(true);
    },
  },
};
