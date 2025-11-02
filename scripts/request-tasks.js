/**
 * @fileoverview A test script to request tasks from the local EBS.
 * It generates a valid Twitch Extension JWT and sends an authenticated GET request
 * to the `/tasks` endpoint, simulating a real frontend API call.
 */
require("dotenv").config();
const fetch = require("node-fetch");
const jwt = require("jsonwebtoken");

const { TWITCH_EXTENSION_SECRET, TWITCH_CLIENT_ID } = process.env;
const PORT = process.env.PORT || 8081;

if (!TWITCH_EXTENSION_SECRET) {
  console.error(
    "TWITCH_EXTENSION_SECRET must be set in environment to generate a JWT.",
  );
  process.exit(2);
}

// Create a short-lived token as the extension would send it
const payload = {
  exp: Math.floor(Date.now() / 1000) + 60,
  user_id: "test-user-1",
  role: "external",
  channel_id: "test-channel",
};

const token = jwt.sign(payload, Buffer.from(TWITCH_EXTENSION_SECRET, "base64"));

(async () => {
  try {
    const res = await fetch(`http://localhost:${PORT}/tasks`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Client-ID": TWITCH_CLIENT_ID || "",
      },
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
