/**
 * @fileoverview A test script to mark a specific task as complete.
 * It generates a moderator JWT and sends a PUT request to the
 * `/tasks/:pageId/complete` endpoint of the local EBS, simulating a
 * moderator action from the frontend.
 */
require("dotenv").config();
const fetch = require("node-fetch");
const jwt = require("jsonwebtoken");

const { TWITCH_EXTENSION_SECRET } = process.env;
const PORT = process.env.PORT || 8081;

if (!TWITCH_EXTENSION_SECRET) {
  console.error(
    "TWITCH_EXTENSION_SECRET must be set in environment to generate a JWT.",
  );
  process.exit(2);
}

const pageId = process.argv[2] || "293a1f4a-1a50-8076-a7c0-f0ddf84b0588"; // sample viewer page id from tests

// Use moderator/broadcaster role to test moderator endpoint
const payload = {
  exp: Math.floor(Date.now() / 1000) + 60,
  user_id: "mod-test",
  opaque_user_id: "mod-test",
  role: "moderator",
  channel_id: "local-test-channel",
};

const token = jwt.sign(payload, Buffer.from(TWITCH_EXTENSION_SECRET, "base64"));

(async () => {
  try {
    const res = await fetch(
      `http://localhost:${PORT}/tasks/${pageId}/complete`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ completed: true }),
      },
    );

    console.log("Status:", res.status);
    const body = await res.text();
    try {
      console.log("Body JSON:", JSON.stringify(JSON.parse(body), null, 2));
    } catch (e) {
      console.log("Body text:", body);
    }
  } catch (err) {
    console.error("Request failed:", err.message || err);
    process.exit(1);
  }
})();
