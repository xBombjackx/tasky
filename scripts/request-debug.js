/**
 * @fileoverview A simple script to test the `/tasks-local` debug endpoint.
 * This script sends a GET request to the local EBS to fetch tasks without
 * requiring a Twitch JWT, which is useful for quick, unauthenticated testing.
 */
const fetch = require("node-fetch");
const PORT = process.env.PORT || 8081;

(async () => {
  try {
    const res = await fetch(`http://localhost:${PORT}/_debug/tasks-local`);
    console.log("Status:", res.status);
    const body = await res.text();
    try {
      console.log("Body JSON:", JSON.stringify(JSON.parse(body), null, 2));
    } catch (e) {
      console.log("Body text:", body);
    }
  } catch (err) {
    console.error("Request failed:", err.message || err);
  }
})();
