// mock-twitch-ext.js
window.Twitch = {
  ext: {
    onAuthorized: async function (callback) {
      console.log("Mock Twitch: onAuthorized() called.");
      try {
        // Get role from URL for testing, e.g., code.html?local=true&role=vip
        const urlParams = new URLSearchParams(window.location.search);
        const role = urlParams.get("role") || "viewer";

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
    onContext: function (callback) {
      // Mock onContext if needed, otherwise leave empty
      console.log("Mock Twitch: onContext() called.");
    },
    // ... mock other functions as needed
  },
};
