# Local Testing Plan

This document outlines the steps to test the Twitch extension locally, including the mock UI and the Notion integration.

## Prerequisites

- **Node.js and npm**: Ensure you have Node.js and npm installed.
- **Notion Account**: You'll need a Notion account with a new integration and two databases (one for streamer tasks, one for viewer tasks).
- **Twitch Dev Account**: A Twitch developer account is required to get an extension secret.

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
    -   `NOTION_API_KEY`: Your Notion integration secret.
    -   `STREAMER_DATABASE_ID`: The ID of your streamer tasks database.
    -   `VIEWER_DATABASE_ID`: The ID of your viewer tasks database.
    -   `TWITCH_EXTENSION_SECRET`: A Base64 encoded secret from your Twitch extension's settings.

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

1.  **Serve the frontend**: Since the frontend is a static `code.html` file, you need a simple HTTP server to serve it to avoid CORS issues.
    ```bash
    python3 -m http.server
    ```
    This will serve the files in the current directory on `http://localhost:8000`.

2.  **Open the frontend in your browser**:
    -   **For UI testing with mock data**: `http://localhost:8000/code.html?local=true`
    -   **For Notion integration testing**: `http://localhost:8000/code.html`

    *Note: For Notion integration testing, you will need a valid Twitch JWT, which is typically only available when the extension is running on Twitch. You can use the mock `twitch-ext.js` to provide a dummy JWT for local testing.*
