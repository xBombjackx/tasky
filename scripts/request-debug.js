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
