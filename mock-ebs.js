// mock-ebs.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const app = express();
const PORT = 8082;

const { TWITCH_EXTENSION_SECRET } = process.env;

app.use(cors());
app.use(express.json()); // Middleware to parse JSON bodies

const mockTasks = {
  streamerTasks: [
    { id: "st1", title: "Finish the main story quest", completed: false },
    { id: "st2", title: "Defeat the secret boss", completed: true },
  ],
  viewerTasks: [
    {
      id: "vt1",
      title: "Use only a pistol for a round",
      submitter: "viewer123",
      role: "Viewer",
      status: "Approved",
    },
    {
      id: "vt2",
      title: "Do a barrel roll!",
      submitter: "anotherViewer",
      role: "Viewer",
      status: "Pending",
    },
    {
      id: "vt3",
      title: "Name a character after me",
      submitter: "big_spender",
      role: "VIP",
      status: "Pending",
    },
    {
      id: "vt4",
      title: "Use your channel point emote",
      submitter: "loyal_fan_t1",
      role: "SubscriberT1",
      status: "Approved",
    },
    {
      id: "vt5",
      title: "Invert mouse controls for 5 mins",
      submitter: "sub_tier_2",
      role: "SubscriberT2",
      status: "Approved",
    },
    {
      id: "vt6",
      title: "This is a bad idea",
      submitter: "troll_user",
      role: "Viewer",
      status: "Rejected",
    },
    {
      id: "vt7",
      title: "Let me pick the next song",
      submitter: "top_supporter",
      role: "SubscriberT3",
      status: "Pending",
    },
    {
      id: "vt8",
      title: "Approve some good tasks!",
      submitter: "mod_squad",
      role: "Moderator",
      status: "Approved",
    },
  ],
};

app.get("/tasks", (req, res) => {
  console.log("Mock EBS: Received request for /tasks");
  res.json(mockTasks);
});

app.get("/mock-jwt", (req, res) => {
  if (!TWITCH_EXTENSION_SECRET) {
    return res
      .status(500)
      .send("TWITCH_EXTENSION_SECRET is not set in .env file.");
  }
  const secret = Buffer.from(TWITCH_EXTENSION_SECRET, "base64");
  const payload = {
    exp: Math.floor(Date.now() / 1000) + 60 * 60, // Expires in 1 hour
    user_id: "123456789", // Mock user ID
    role: req.query.role || "viewer", // Role can be passed as a query param, e.g., /mock-jwt?role=vip
    channel_id: "987654321",
    opaque_user_id: `U${Math.random().toString(36).substring(2)}`,
  };

  const token = jwt.sign(payload, secret);
  res.json({ token });
});

app.post("/tasks", (req, res) => {
  console.log("Mock EBS: Received request for POST /tasks");
  const { title, submitter } = req.body;
  // In a real EBS, you would verify the JWT from the Authorization header
  // and extract the role from its payload.
  // For this mock, we'll just simulate it.
  const authHeader = req.headers["authorization"];
  let role = "Viewer"; // default role
  if (authHeader && authHeader.startsWith("Bearer mock-jwt-")) {
    const roleFromJwt = authHeader.split("mock-jwt-")[1] || "Viewer";
    // The role from the JWT is typically lowercase, e.g., 'vip', 'moderator'.
    // We need to map it to the exact format defined in TESTPLAN.md.
    switch (roleFromJwt.toLowerCase()) {
      case "vip":
        role = "VIP";
        break;
      case "moderator":
        role = "Moderator";
        break;
      case "subscribert1":
        role = "SubscriberT1";
        break;
      case "subscribert2":
        role = "SubscriberT2";
        break;
      case "subscribert3":
        role = "SubscriberT3";
        break;
      default:
        role = roleFromJwt.charAt(0).toUpperCase() + roleFromJwt.slice(1);
    }
  }

  const newTask = {
    id: `vt${Date.now()}`, // Use a more unique ID
    title: title, // The frontend can add prefixes if it wants
    submitter,
    role,
    status: "Pending", // New tasks should always start as Pending
  };
  mockTasks.viewerTasks.push(newTask);
  console.log("Added new task:", newTask);
  res.status(201).json(newTask);
});

app.put("/tasks/me/complete", (req, res) => {
  const { completed } = req.body;
  console.log(
    `Mock EBS: Received request for PUT /tasks/me/complete with completed: ${completed}`,
  );
  // In a real app, you'd find the task for the user from the JWT and update it.
  // For the mock, we can just log it and return success.
  res.status(200).json({ success: true, completed: completed });
});

app.put("/tasks/:pageId/complete", (req, res) => {
  const { pageId } = req.params;
  const { completed } = req.body;
  console.log(
    `Mock EBS: Received request for PUT /tasks/${pageId}/complete with completed: ${completed}`,
  );
  res.status(200).json({ success: true, pageId: pageId, completed: completed });
});

app.listen(PORT, () => {
  console.log(`Mock EBS server running on http://localhost:${PORT}`);
});
