# Twitch Notion Task Overlay

This project is a Twitch extension that displays tasks from a Notion database as an overlay on a livestream. It allows viewers to see the streamer's current tasks and even submit their own tasks for approval.

## Prerequisites

- Node.js and npm installed
- A Twitch account with Extension developer access
- A Notion account and API key
- Two Notion databases (one for streamer tasks, one for viewer-submitted tasks)

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

1. **Create a `.env` file** in the root of the project and add the following environment variables:

   ```
   NOTION_API_KEY="your_notion_api_key"
   STREAMER_DATABASE_ID="your_streamer_database_id"
   VIEWER_DATABASE_ID="your_viewer_database_id"
   TWITCH_EXTENSION_SECRET="your_twitch_extension_secret"
   ```

   - `NOTION_API_KEY`: Your Notion API key.
   - `STREAMER_DATABASE_ID`: The ID of your Notion database for streamer tasks.
   - `VIEWER_DATABASE_ID`: The ID of your Notion database for viewer-submitted tasks.
   - `TWITCH_EXTENSION_SECRET`: Your Twitch extension's secret key.

2. **Update the `EBS_URL` in `video_overlay.html`:**
   - Change the `EBS_URL` constant to the URL of your running Extension Backend Service (EBS).

## Running the Application

1. **Start the EBS:**
   ```bash
   node ebs.js
   ```
   The EBS will run on the port specified in your environment or on the default port.

2. **Serve the frontend:**
   - The `video_overlay.html` file and other static assets need to be served over HTTPS. You can use a tool like `ngrok` to expose your local server to the internet.

## How to Use

- **Streamer:** Add tasks to your streamer Notion database, and they will appear in the overlay.
- **Viewers:** Can submit tasks through the extension, which will be added to the viewer Notion database after moderator approval.
- **Moderators:** Can approve or reject viewer-submitted tasks.

## Local Testing

For detailed instructions on how to test the extension locally, including both the UI with mock data and the full Notion integration, please see the [TESTPLAN.md](TESTPLAN.md) file.
