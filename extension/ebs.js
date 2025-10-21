// --- Core Dependencies ---
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Client } = require('@notionhq/client');
// We will need this for verifying Twitch's JWTs
const jwt = require('jsonwebtoken'); 

// --- Environment Variable Setup ---
const {
    NOTION_API_KEY,
    STREAMER_DATABASE_ID,
    VIEWER_DATABASE_ID,
    TWITCH_EXTENSION_SECRET // IMPORTANT: We need a new secret from the Twitch Dev Console
} = process.env;

// --- Initialization ---
const app = express();
const PORT = process.env.PORT || 8081; // Extensions often use 8081 for the EBS
const notion = new Client({ auth: NOTION_API_KEY });

// --- Middleware ---
app.use(cors()); // Allow requests from the Twitch extension frontend
app.use(express.json()); // Allow the server to parse JSON request bodies

// --- Twitch JWT Verification Middleware ---
// Every request from the extension will have a JWT. We must verify it.
function verifyTwitchJWT(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1]; // Get token from "Bearer <token>"
    if (!token) {
        return res.status(401).send('Unauthorized: Missing token');
    }

    try {
        // The secret must be Base64 decoded, as per Twitch's documentation
        const decodedSecret = Buffer.from(TWITCH_EXTENSION_SECRET, 'base64');
        const decodedToken = jwt.verify(token, decodedSecret);
        
        // Attach user info to the request for later use
        req.twitch = decodedToken; 
        
        next(); // Token is valid, proceed to the actual API endpoint
    } catch (err) {
        console.error("JWT Verification Error:", err.message);
        return res.status(401).send('Unauthorized: Invalid token');
    }
}


// --- Notion Helper Functions (Mostly the same as before) ---
const dataSourceCache = new Map();
// ... (getDataSourceId, findUserTask, addViewerTask, etc. would go here, adapted for the new flow)
// For now, let's focus on the new API structure.

async function getTasksForOverlay() {
    // This function will be very similar to the one we already wrote
    // It will fetch active streamer and viewer tasks from Notion
    console.log("Fetching tasks from Notion...");
    // Placeholder data for now:
    return {
      streamerTasks: [{ id: '1', type: 'streamer', title: 'Become a Twitch Extension' }],
      viewerTasks: [{ id: '2', type: 'viewer', title: 'Click the checkbox!', submitter: 'SomeUser' }]
    };
}


// --- API Endpoints for the Extension ---

// GET /tasks - Fetches all active tasks
// This endpoint is "public" in the sense that any viewer can see the tasks.
app.get('/tasks', verifyTwitchJWT, async (req, res) => {
    console.log(`[EBS] Received GET /tasks request from user: ${req.twitch.user_id}`);
    const tasks = await getTasksForOverlay();
    res.json(tasks);
});

// POST /tasks - A viewer submits a new task
app.post('/tasks', verifyTwitchJWT, async (req, res) => {
    const { taskDescription } = req.body;
    const twitchUserId = req.twitch.user_id; // Securely get the user ID from the verified token
    console.log(`[EBS] User ${twitchUserId} is submitting task: "${taskDescription}"`);
    
    // TODO: Add the actual notion.pages.create logic here
    
    res.status(201).json({ message: 'Task submitted successfully for approval!' });
});

// PUT /tasks/:pageId/approve - A moderator approves a task
app.put('/tasks/:pageId/approve', verifyTwitchJWT, async (req, res) => {
    // We get role from the JWT, which is secure
    if (req.twitch.role !== 'broadcaster' && req.twitch.role !== 'moderator') {
        return res.status(403).send('Forbidden: Only moderators or the broadcaster can approve tasks.');
    }
    const { pageId } = req.params;
    console.log(`[EBS] Mod/Broadcaster is approving task with page ID: ${pageId}`);
    
    // TODO: Add the actual notion.pages.update logic here
    
    res.json({ message: 'Task approved!' });
});


// --- Server Start ---
app.listen(PORT, () => {
    console.log(`[EBS] Extension Backend Service listening on http://localhost:${PORT}`);
});
