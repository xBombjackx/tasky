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

| Property Name | Type       | Description                                                              |
| ------------- | ---------- | ------------------------------------------------------------------------ |
| `Task`        | `Title`    | The name or description of the task. This is the main property.          |
| `Status`      | `Status`   | The current status of the task. Options: `To-do`, `In progress`, `Done`. |
| `Cost`        | `Number`   | (Optional) The cost of the task, e.g., in channel points.                |
| `Completed`   | `Checkbox` | A checkbox to indicate if the task is completed.                         |

### Viewer Tasks Database Schema

This database holds tasks submitted by viewers.

| Property Name  | Type       | Description                                                                                                      |
| -------------- | ---------- | ---------------------------------------------------------------------------------------------------------------- |
| `Task`         | `Title`    | The name or description of the task. This is the main property.                                                  |
| `Suggested by` | `Text`     | The Twitch username of the viewer who submitted the task.                                                        |
| `Role`         | `Select`   | The role of the submitter. Options: `Viewer`, `VIP`, `SubscriberT1`, `SubscriberT2`, `SubscriberT3`,`Moderator`. |
| `Status`       | `Status`   | The status of the suggestion. Options: `Pending`, `Approved`, `Rejected`.                                        |
| `Completed`    | `Checkbox` | A checkbox to indicate if the task has been completed by the streamer.                                           |

**Note:** Ensure the property names in your Notion databases match exactly what
is listed above, as the integration will use these names to read and write data.

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
