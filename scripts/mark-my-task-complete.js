// Script: mark-my-task-complete.js
// Sends PUT /tasks/me/complete to the local EBS using a generated Twitch extension JWT
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

// Minimal payload for a viewer. Adjust 'opaque_user_id' to match an approved task's 'Suggested by' if needed.
const payload = {
  exp: Math.floor(Date.now() / 1000) + 60,
  user_id: "local-test-user",
  opaque_user_id: "local-test-user", // change if your Notion 'Suggested by' is different
  role: "viewer",
  channel_id: "local-test-channel",
};

const token = jwt.sign(payload, Buffer.from(TWITCH_EXTENSION_SECRET, "base64"));

(async () => {
  try {
    const res = await fetch(`http://localhost:${PORT}/tasks/me/complete`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ completed: true }),
    });

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
