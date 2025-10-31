# Local Testing Plan

This document outlines the steps to test the Twitch extension locally. The local environment requires running three separate servers to fully simulate the production setup and allow for both isolated UI testing and full integration testing.

## Server Roles

1.  **Frontend Server (port 8080)**: A simple HTTP server that serves the static frontend files (`code.html`, `panel.html`, `config.html`, CSS, etc.).
2.  **Notion EBS (port 8081)**: The primary Extension Backend Service (EBS) that connects to the Notion API, handles business logic, and manages authentication. This is the "real" backend.
3.  **Mock EBS (port 8082)**: A lightweight mock server that simulates the EBS. It returns static, predictable data, which is useful for developing and testing the frontend UI in isolation without needing a live Notion connection.

## Configuration

1.  **Create a `.env` file** in the root of the project.

2.  **Add the following environment variables** to the `.env` file:

    ```
    NOTION_API_KEY="your_notion_api_key"
    TWITCH_EXTENSION_SECRET="your_twitch_extension_secret"
    # The following database IDs are needed for the Notion EBS to work in local testing mode
    STREAMER_DATABASE_ID="your_streamer_database_id"
    VIEWER_DATABASE_ID="your_viewer_database_id"
    ```

3.  **Populate the `.env` file**:
    - `NOTION_API_KEY`: Your Notion integration secret.
    - `TWITCH_EXTENSION_SECRET`: A Base64 encoded secret from your Twitch extension's settings.
    - `STREAMER_DATABASE_ID`: The ID of your streamer tasks database.
    - `VIEWER_DATABASE_ID`: The ID of your viewer tasks database.

## Running the Local Environment

You will need three separate terminal sessions to run the full local testing environment.

### Terminal 1: Start the Frontend Server

This server hosts the static HTML and CSS files.

```bash
npx http-server -p 8080
```

### Terminal 2: Start the Notion EBS (Main Backend)

This is the primary backend service that connects to the Notion API.

```bash
npm run start:ebs
```

### Terminal 3: Start the Mock EBS

This server provides mock data for UI development.

```bash
node mock-ebs.js
```

## Accessing and Testing the Frontend Views

With all three servers running, you can now test the different parts of the extension in your browser. The `?local=true` query parameter is required to load a mock version of the Twitch extension helper script.

-   **Video Overlay (`code.html`)**
    -   **URL:** `http://localhost:8080/code.html?local=true`
    -   **Backend Connection:** This view connects to the **Mock EBS (port 8082)** by default. It will display the static task list from `mock-ebs.js`.

-   **Viewer Submission Panel (`panel.html`)**
    -   **URL:** `http://localhost:8080/panel.html?local=true`
    -   **Backend Connection:** This view connects to the **Mock EBS (port 8082)**. Submitting a task will send the data to the mock server.

-   **Configuration & Moderation Panel (`config.html`)**
    -   **URL:** `http://localhost:8080/config.html?local=true`
    -   **Backend Connection:** This view connects to the **Mock EBS (port 8082)**. It will display the pending tasks defined in `mock-ebs.js`, allowing you to test the moderation UI.

### Testing with the Live Notion EBS

To test the frontend against the **live Notion EBS (port 8081)**, you would need to temporarily modify the `getEbsUrl` function in the respective HTML files (`code.html`, `panel.html`, `config.html`) to point to `http://localhost:8081` instead of `8082`. This allows you to perform end-to-end integration testing. Remember to revert this change before committing.

## Notion Database Setup

For the Notion EBS to function correctly, you need to set up two databases in Notion with the correct schema.

### Streamer Tasks Database Schema

| Property Name | Type       | Description                                                                    |
| ------------- | ---------- | ------------------------------------------------------------------------------ |
| `Task`        | `Title`    | The name or description of the task.                                           |
| `Status`      | `Status`   | The current status of the task (`Not started`, `In progress`, `Done`).          |
| `Completed`   | `Checkbox` | A checkbox to indicate if the task is completed.                               |

### Viewer Tasks Database Schema

| Property Name     | Type        | Description                                                                                                      |
| ----------------- | ----------- | ---------------------------------------------------------------------------------------------------------------- |
| `Task`            | `Title`     | The name or description of the task.                                                                             |
| `Suggested by`    | `Rich text` | The Twitch opaque ID of the viewer who submitted the task.                                                       |
| `Role`            | `Select`    | The role of the submitter (`Viewer`, `VIP`, `SubscriberT1`, `SubscriberT2`, `SubscriberT3`, `Moderator`).         |
| `Status`          | `Status`    | The lifecycle status of the task *after* approval (`Not started`, `In progress`, `Done`).                        |
| `Approval Status` | `Select`    | The moderation state of a submitted task (`Pending`, `Approved`, `Rejected`).                                     |
| `Completed`       | `Checkbox`  | A checkbox to indicate if the task has been completed.                                                           |

**Note:** Ensure the property names and `Select` options in your Notion databases match exactly what is listed above.
