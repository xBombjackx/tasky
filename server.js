// --- Core Dependencies ---
require('dotenv').config();
const express = require('express');
const tmi = require('tmi.js');
const { Client } = require('@notionhq/client');
const cors = require('cors');

// --- Environment Variable Setup ---
const {
    NOTION_API_KEY,
    STREAMER_DATABASE_ID,
    VIEWER_DATABASE_ID,
    TWITCH_BOT_USERNAME,
    TWITCH_BOT_OAUTH,
    TWITCH_CHANNEL_NAME,
} = process.env;

// --- Initialization ---
const app = express();
const PORT = process.env.PORT || 3000;
const notion = new Client({ auth: NOTION_API_KEY });

// --- Middleware ---
app.use(cors()); // <-- AND ADD THIS LINE

// --- Notion Helper Functions ---
// (All the Notion functions remain exactly the same)

const dataSourceCache = new Map();

async function getDataSourceId(databaseId) {
    if (dataSourceCache.has(databaseId)) {
        return dataSourceCache.get(databaseId);
    }
    try {
        const response = await notion.databases.retrieve({ database_id: databaseId });
        if (response.data_sources && response.data_sources.length > 0) {
            const dataSourceId = response.data_sources[0].id;
            dataSourceCache.set(databaseId, dataSourceId);
            return dataSourceId;
        }
        return null;
    } catch (error) {
        console.error(`Failed to get data source ID for DB ${databaseId}:`, error.body || error);
        return null;
    }
}

async function findUserTask(username, approvalStatus) {
    const dataSourceId = await getDataSourceId(VIEWER_DATABASE_ID);
    if (!dataSourceId) return null;
    try {
        const response = await notion.dataSources.query({
            data_source_id: dataSourceId,
            filter: {
                and: [
                    { property: 'Submitter', rich_text: { equals: username } },
                    { property: 'Approval Status', select: { equals: approvalStatus } },
                ],
            },
        });
        return response.results.length > 0 ? response.results[0] : null;
    } catch (error) {
        console.error(`[NOTION] Error finding task for ${username}:`, error.body || error);
        return null;
    }
}

async function addViewerTask(username, taskDescription) {
    try {
        await notion.pages.create({
            parent: { database_id: VIEWER_DATABASE_ID },
            properties: {
                'Name': { title: [{ text: { content: taskDescription } }] },
                'Submitter': { rich_text: [{ text: { content: username } }] },
                'Approval Status': { select: { name: 'Pending' } },
                'Status': { checkbox: false },
            },
        });
        console.log(`[NOTION] Added task for ${username}: "${taskDescription}"`);
    } catch (error) {
        console.error('[NOTION] Error adding task:', error.body || error);
    }
}

async function approveViewerTask(username) {
    const task = await findUserTask(username, 'Pending');
    if (task) {
        await notion.pages.update({
            page_id: task.id,
            properties: { 'Approval Status': { select: { name: 'Approved' } } },
        });
        console.log(`[NOTION] Approved task for ${username}`);
        return `Task for @${username} has been approved!`;
    }
    return `No pending task found for @${username}.`;
}

async function rejectViewerTask(username) {
    const task = await findUserTask(username, 'Pending');
    if (task) {
        await notion.pages.update({ page_id: task.id, archived: true });
        console.log(`[NOTION] Rejected (archived) task for ${username}`);
        return `Task for @${username} has been rejected.`;
    }
    return `No pending task found for @${username} to reject.`;
}

async function updateViewerTaskStatus(username, isComplete) {
    const task = await findUserTask(username, 'Approved');
    if (task) {
        await notion.pages.update({
            page_id: task.id,
            properties: { 'Status': { checkbox: isComplete } },
        });
        const statusText = isComplete ? 'completed' : 'reset to active';
        console.log(`[NOTION] Task for ${username} marked as ${statusText}`);
        return `@${username}'s task has been marked as ${statusText}!`;
    }
    return `@${username}, no active task found for you to update.`;
}

async function getTasksForOverlay() {
    try {
        const streamerDsId = await getDataSourceId(STREAMER_DATABASE_ID);
        const viewerDsId = await getDataSourceId(VIEWER_DATABASE_ID);

        if (!streamerDsId || !viewerDsId) {
            throw new Error("Could not retrieve data source IDs for one or both databases.");
        }

        const [streamerResponse, viewerResponse] = await Promise.all([
            notion.dataSources.query({
                data_source_id: streamerDsId,
                filter: { property: 'Status', checkbox: { equals: false } },
            }),
            notion.dataSources.query({
                data_source_id: viewerDsId,
                filter: {
                    and: [
                        { property: 'Approval Status', select: { equals: 'Approved' } },
                        { property: 'Status', checkbox: { equals: false } },
                    ],
                },
            }),
        ]);

        const streamerTasks = streamerResponse.results.map(page => ({
            id: page.id,
            type: 'streamer',
            title: page.properties.Name?.title[0]?.plain_text || 'Untitled Task',
        }));

        const viewerTasks = viewerResponse.results.map(page => ({
            id: page.id,
            type: 'viewer',
            title: page.properties.Name?.title[0]?.plain_text || 'Untitled Task',
            submitter: page.properties.Submitter?.rich_text[0]?.plain_text || 'Unknown',
        }));

        return { streamerTasks, viewerTasks };
    } catch (error) {
        console.error("[NOTION] Failed to get tasks for overlay:", error.body || error);
        return { streamerTasks: [], viewerTasks: [] };
    }
}

// --- Twitch Bot Setup ---
const twitchClient = new tmi.Client({
    options: { debug: true, messagesLogLevel: "info" },
    identity: {
        username: TWITCH_BOT_USERNAME,
        password: TWITCH_BOT_OAUTH,
    },
    channels: [TWITCH_CHANNEL_NAME],
});

twitchClient.connect().catch(console.error);

twitchClient.on('message', (channel, tags, message, self) => {
    if (self || !message.startsWith('!')) return;

    const isMod = tags.mod || tags.username.toLowerCase() === TWITCH_CHANNEL_NAME.toLowerCase();
    const args = message.slice(1).split(' ');
    const command = args.shift().toLowerCase();
    const username = tags.username;

    if (command === 'task') {
        const taskDescription = args.join(' ');
        if (taskDescription) {
            addViewerTask(username, taskDescription);
            twitchClient.say(channel, `@${username}, your task has been submitted for approval!`);
        }
    }
    if (command === 'approve' && isMod) {
        const userToApprove = args[0]?.replace('@', '').toLowerCase();
        if (userToApprove) {
            approveViewerTask(userToApprove).then(msg => twitchClient.say(channel, msg));
        }
    }
    if (command === 'reject' && isMod) {
        const userToReject = args[0]?.replace('@', '').toLowerCase();
        if (userToReject) {
            rejectViewerTask(userToReject).then(msg => twitchClient.say(channel, msg));
        }
    }
    if (command === 'done') {
        updateViewerTaskStatus(username, true).then(msg => twitchClient.say(channel, msg));
    }
    if (command === 'undo') {
        updateViewerTaskStatus(username, false).then(msg => twitchClient.say(channel, msg));
    }
});

// --- Express Server ---
app.get('/', (req, res) => {
    res.send('Twitch-Notion Overlay Backend is running!');
});

app.get('/tasks', async (req, res) => {
    console.log("[SERVER] Received request for /tasks");
    const tasks = await getTasksForOverlay();
    res.json(tasks);
});

app.listen(PORT, () => {
    console.log(`[SERVER] Listening on port http://localhost:${PORT}`);
});

