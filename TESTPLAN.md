# Local Testing Plan

This document outlines the steps to test the Twitch extension locally, including
the mock UI and the Notion integration.

## Prerequisites

- **Node.js and npm**: Ensure you have Node.js and npm installed.
- **Notion Account**: You'll need a Notion account with a new integration and
  two databases (one for streamer tasks, one for viewer tasks).
- **Twitch Dev Account**: A Twitch developer account is required to get an
  extension secret.

## Configuration

1.  **Create a `.env` file** in the root of the project.

2.  **Add the following environment variables** to the `.env` file:

    ```
    NOTION_API_KEY="your_notion_api_key"
    STREAMER_DATABASE_ID="your_streamer_database_id"
    VIEWER_DATABASE_ID="your_viewer_database_id"
    TWITCH_EXTENSION_SECRET="your_twitch_extension_secret"
    ```

3.  **Populate the `.env` file**:
    - `NOTION_API_KEY`: Your Notion integration secret.
    - `STREAMER_DATABASE_ID`: The ID of your streamer tasks database.
    - `VIEWER_DATABASE_ID`: The ID of your viewer tasks database.
    - `TWITCH_EXTENSION_SECRET`: A Base64 encoded secret from your Twitch
      extension's settings.

## Notion Database Setup

Before running the application, you need to set up two databases in Notion with
the correct schema.

### Streamer Tasks Database Schema

This database holds tasks for the streamer.

| Property Name | Type       | Description                                                                    |
| ------------- | ---------- | ------------------------------------------------------------------------------ |
| `Task`        | `Title`    | The name or description of the task. This is the main property.                |
| `State`       | `Status`   | The current status of the task. Options: `Not started`, `In progress`, `Done`. |
| `Cost`        | `Number`   | (Optional) The cost of the task, e.g., in channel points.                      |
| `Completed`   | `Checkbox` | A checkbox to indicate if the task is completed.                               |

### Viewer Tasks Database Schema

This database holds tasks submitted by viewers.

| Property Name     | Type        | Description                                                                                                      |
| ----------------- | ----------- | ---------------------------------------------------------------------------------------------------------------- |
| `Task`            | `Title`     | The name or description of the task. This is the main property.                                                  |
| `Suggested by`    | `Rich text` | The Twitch username or opaque ID of the viewer who submitted the task.                                           |
| `Role`            | `Select`    | The role of the submitter. Options: `Viewer`, `VIP`, `SubscriberT1`, `SubscriberT2`, `SubscriberT3`,`Moderator`. |
| `Status`          | `Status`    | The status of the suggestion. Options: `Pending`, `Approved`, `Rejected`.                                        |
| `Approval Status` | `Select`    | Moderation state used by the EBS migration/approval workflow. Options: `Pending`, `Approved`, `Rejected`.        |
| `Completed`       | `Checkbox`  | A checkbox to indicate if the task has been completed by the streamer.                                           |

**Note:** Ensure the property names in your Notion databases match exactly what
is listed above, as the integration will use these names to read and write data.
The `Role` property's `Select` options must be capitalized exactly as shown.
**Important**: The `State` property on the Streamer database is intentionally
named `State` to match the current backend code.

## Running the Servers

You will need two terminal sessions for local testing.

### Terminal 1: Mock EBS (for UI testing)

1.  **Install dependencies**:

    ```bash
    npm install
    ```

2.  **Start the mock EBS**:
    ```bash
    node mock-ebs.js
    ```
    This will start a mock server on `http://localhost:8082`.

### Terminal 2: Notion EBS (for integration testing)

1.  **Start the Notion EBS**:
    ```bash
    npm run start:ebs
    ```
    This will start the Notion backend service on `http://localhost:8081`.

## Testing the Frontend

1.  **Serve the frontend**: Since the frontend is a static `code.html` file, you
    need a simple HTTP server to serve it. You can use the `http-server` package
    via `npx`, which comes with Node.js.

    ```bash
    npx http-server -p 8080
    ```

    This will serve the files in the current directory on
    `http://localhost:8080`. If it's your first time, `npx` will ask for
    permission to download the package.

2.  **Open the frontend in your browser**:
    - **For UI testing with mock data**:
      `http://localhost:8080/code.html?local=true`
    - **For Notion integration testing**:
      `http://localhost:8080/code.html?local=true&ebs=notion`

    _Note: The `local=true` parameter loads a mock Twitch helper
    (`mock-twitch-ext.js`) that provides the necessary JWT for local testing.
    The `ebs=notion` parameter tells the frontend to connect to your real Notion
    EBS._

## API endpoints & helper scripts

Below are the important server endpoints and the helper scripts included in this
repository. These are useful for local testing and debugging.

- `GET /tasks` (requires Twitch JWT) — returns `{ streamerTasks, viewerTasks }`
  for the overlay.
- `POST /tasks` (requires Twitch JWT) — viewer submits a new task (blocked if
  content matches prohibited patterns).
- `PUT /tasks/:pageId/approve` (requires moderator/broadcaster JWT) — approve a
  viewer task; the server will auto-reject if the content is prohibited.
- `GET /_debug/tasks-local` (development only, no auth) — returns tasks using DB
  IDs from the environment (handy for local testing).

Helper scripts (in `scripts/`):

- `request-debug.js` — Calls `/_debug/tasks-local` and prints JSON (no auth
  required).
- `request-tasks.js` — Generates a short JWT from `.env` and calls `GET /tasks`
  to simulate the extension.
- `direct-get-tasks.js` — Queries Notion directly using the same filters as the
  overlay and prints page samples.
- `print-notion-schema.js` — Prints Notion database property names and types for
  the configured DBs.
- `fill-approval-status.js` — Fills `Approval Status` select on existing viewer
  pages using their `Status` values (migration helper).
- `auto-reject-prohibited.js` — Scans viewer DB titles for prohibited content
  and archives + marks `Approval Status=Rejected`.

### Example: Approving a viewer task (power user)

Use the following steps to approve a viewer-submitted task in local testing. You
will need a moderator or broadcaster JWT (short-lived). These examples use
PowerShell but equivalent curl commands are shown too.

PowerShell (generate a moderator token and approve):

```powershell
# generate a short-lived moderator JWT (1 minute)
$token = node -e "console.log(require('jsonwebtoken').sign({exp:Math.floor(Date.now()/1000)+60,user_id:'mod1',role:'moderator',channel_id:'test-channel'}, Buffer.from(process.env.TWITCH_EXTENSION_SECRET,'base64')))"

# approve the task (replace <PAGE_ID> with the page id from the debug output)
Invoke-RestMethod -Uri "http://localhost:8081/tasks/<PAGE_ID>/approve" -Method Put -Headers @{ Authorization = "Bearer $token" }
```

curl equivalent:

```bash
# export a moderator token into $TOKEN (example for bash)
TOKEN=$(node -e "console.log(require('jsonwebtoken').sign({exp:Math.floor(Date.now()/1000)+60,user_id:'mod1',role:'moderator',channel_id:'test-channel'}, Buffer.from(process.env.TWITCH_EXTENSION_SECRET,'base64')))" )

curl -X PUT "http://localhost:8081/tasks/<PAGE_ID>/approve" -H "Authorization: Bearer $TOKEN"
```

If the task title contains prohibited content, the server will auto-reject and
archive it instead of approving it; the response will indicate the rejection.

### Example: Testing content moderation

1.  **Test submission rejection**: Use the `POST /tasks` endpoint (or the
    extension UI) to submit a task with a title containing a prohibited phrase.
    The request should fail with an HTTP 400 error.

2.  **Test approval rejection**: a. Manually create a task in your viewer Notion
    database with a prohibited title. b. Get the page ID for that task. c. Use
    the `PUT /tasks/<PAGE_ID>/approve` endpoint with a moderator JWT. d. The
    request should succeed, but the server response and the Notion page should
    indicate that the task was `Rejected` instead of `Approved`.

This two-step test verifies that the content filter works for both new
submissions and for tasks that might have been added to Notion before the filter
was in place.

## Moderation and content filtering

The EBS includes a simple server-side prohibited-content checker to avoid
displaying or approving clearly harmful phrases (for example, explicit self-harm
instructions). Behavior:

- New viewer submissions that match the prohibited patterns are rejected with
  HTTP 400 and are not created in Notion.
- If a moderator attempts to approve a task whose title matches the prohibited
  patterns, the server will auto-reject and archive the page and set
  `Approval Status=Rejected`.

This protector is intentionally conservative and implemented as a small
regex-based list. For production use you may want to integrate a dedicated
moderation service (Perspective API, or a hosted moderation model) for higher
accuracy and localization support.
