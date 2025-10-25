// mock-twitch-ext.js
window.Twitch = {
  ext: {
    onAuthorized: function (callback) {
      console.log("Mock Twitch: onAuthorized() called.");
      // Simulate successful authorization immediately
      setTimeout(() => {
        callback({
          token: "mock-jwt-token",
          userId: "123456789",
          channelId: "987654321",
        });
      }, 100); // Small delay to mimic async behavior
    },
    onContext: function (callback) {
      // Mock onContext if needed, otherwise leave empty
      console.log("Mock Twitch: onContext() called.");
    },
    // ... mock other functions as needed
  },
};
