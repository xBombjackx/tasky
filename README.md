# Twitch Notion Task Overlay

This project is a Twitch extension that displays tasks from a Notion database as
a video overlay on a livestream. It consists of three frontend components:
- `code.html`: The video overlay that viewers see.
- `panel.html`: A panel where viewers can submit new tasks.
- `config.html`: A configuration page for the streamer and their moderators.

## Prerequisites

- Node.js and npm installed
- A Twitch account with Extension developer access
- A Notion account and API key

## Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/your-username/your-repo-name.git
   cd your-repo-name
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

## Configuration

1. **Create a `.env` file** in the root of the project and add the following
   environment variables:

   ```
   NOTION_API_KEY="your_notion_api_key"
   TWITCH_EXTENSION_SECRET="your_twitch_extension_secret"
   # The following are optional and primarily for local testing without the Twitch Config Service
   STREAMER_DATABASE_ID="your_streamer_database_id"
   VIEWER_DATABASE_ID="your_viewer_database_id"
   ```

   - `NOTION_API_KEY`: Your Notion API key.
   - `TWITCH_EXTENSION_SECRET`: Your Twitch extension's secret key (must be Base64 encoded).
   - `STREAMER_DATABASE_ID`, `VIEWER_DATABASE_ID`: These are the IDs of the Notion databases. In production, these are stored in the Twitch Configuration Service. For local testing, they can be set in the `.env` file.

## Running the Application for Local Development

Local development requires running three separate servers in different terminal sessions.

1.  **Terminal 1: Start the Mock EBS**
    - This server simulates the Twitch backend and provides mock data for UI development.
    ```bash
    node mock-ebs.js
    ```

2.  **Terminal 2: Start the Notion EBS (Main Backend)**
    - This is the primary backend service that connects to the Notion API.
    ```bash
    npm run start:ebs
    ```

3.  **Terminal 3: Start the Frontend Server**
    - This server hosts the static HTML and CSS files.
    ```bash
    npx http-server -p 8080
    ```

## How to Use

- **Streamer:** Add tasks to your streamer Notion database, which appear in the overlay. Use the configuration page to manage settings and moderate viewer-submitted tasks.
- **Viewers:** Can submit tasks through the extension panel, which will be added to the viewer Notion database after moderator approval.
- **Moderators:** Can approve or reject viewer-submitted tasks via the configuration page.

## Local Testing

For detailed instructions on how to test the extension locally, including how to access the different frontend views and interact with the mock and live backends, please see the [LOCAL_TESTING.md](LOCAL_TESTING.md) file.
