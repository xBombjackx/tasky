-----

# Product Design Document: Notion Task-Sync Overlay (NTSO)

**Version:** 1.0 (MVP)
**Status:** PDD Draft

## Overview

### Key Project Data

| Key | Value |
| :--- | :--- |
| **Product Name** | Notion Task-Sync Overlay (NTSO) |
| **Primary Platform** | OBS/Streamlabs (via Browser Source) |
| **Backend** | Notion API |
| **Primary Integration** | Twitch API (Chat Commands & Events) |
| **Target Users** | Streamer (Primary), Live Viewers, Moderators |

---

--

## 1\. Goals and Success Metrics

### 1.1 Project Goals

The primary goal is to deepen community interaction and shared productivity during live streams by connecting a live, on-stream overlay directly to a persistent Notion database. This creates a "two-way" bridge, allowing real-time collaboration between the streamer, their viewers, and their central planning tool (Notion).

### 1.2 Success Metrics (Key Performance Indicators - KPIs)

- **Viewer Task Submission Rate:** The average number of viewer tasks submitted via `!task` per stream.
- **Task Completion Rate:** The ratio of viewer-submitted tasks marked "complete" versus the total number of approved tasks.
- **API Health:** Successful Notion API read/write operations vs. errors.
- **Interaction Latency:** Time from a chat command (e.g., `!done`) to the visual update on the overlay.

---

## 2\. Product Overview and Core Architecture

The NTSO is a custom web application, hosted by the streamer (e.g., locally or on Vercel/Netlify), and added as a Browser Source in OBS. This app is responsible for:

1.  **Reading** from specified Notion databases to populate the overlay.
2.  **Writing** to the Notion databases when tasks are updated.
3.  **Listening** to Twitch chat commands to trigger these read/write operations.

All application "state" (the tasks themselves) is stored _exclusively_ in Notion. The overlay is a visual, real-time representation of the Notion data.

### 2.1 Required Notion Setup (The "Backend")

The streamer must create **two** separate databases in their Notion workspace and share them with a custom Notion API integration:

1.  **Streamer Tasks Database:**
    - `Task Name` (Title)
    - `Status` (Checkbox)

2.  **Viewer Tasks Database:**
    - `Task Name` (Title)
    - `Status` (Checkbox)
    - `Submitter` (Text) - _Stores the Twitch username_
    - `Approval Status` (Select) - _With options: "Pending", "Approved"_

### 2.2 Core User Flows

| User Type        | Action                                                                                       | System Response                                                                                                                                                                                                                                                    |
| :--------------- | :------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Viewer**       | **Task Submission:** Submits a task via `!task [description]`.                               | 1. Backend service creates a new page in the "Viewer Tasks" DB. <br> 2. Sets `Task Name` to `[description]`, `Submitter` to `username`, and `Approval Status` to "Pending". <br> 3. Bot sends chat confirmation ("Task submitted for approval\!").                 |
| **Mod/Streamer** | **Task Approval:** Approves a pending task via `!approve [user]`.                            | 1. Backend finds the "Pending" task for `[user]`. <br> 2. Updates its `Approval Status` property to "Approved". <br> 3. Overlay polls Notion and the task appears on the "Viewer Tasks" list. <br> 4. Bot sends chat confirmation ("@user's task was approved\!"). |
| **Mod/Streamer** | **Task Rejection:** Rejects a pending task via `!reject [user]`.                             | 1. Backend finds the "Pending" task for `[user]`. <br> 2. Deletes the page from the Notion database. <br> 3. Bot sends chat confirmation.                                                                                                                          |
| **Viewer**       | **Task Completion:** Marks their _own_ task complete via `!done` or `!status complete`.      | 1. Backend finds the "Approved" task for that `[user]`. <br> 2. Updates its `Status` property to `true` (checked). <br> 3. Overlay updates to show the task as checked/strike-through.                                                                             |
| **Viewer**       | **Task Un-completion:** Marks their _own_ task active again via `!undo` or `!status active`. | 1. Backend finds the "Approved" task for that `[user]`. <br> 2. Updates its `Status` property to `false` (unchecked). <br> 3. Overlay updates to show the task as active.                                                                                          |
| **Mod/Streamer** | **Manage Any Task:** Force-completes or removes any viewer task.                             | 1. `!donetask [user]` updates `Status` to `true`. <br> 2. `!removetask [user]` deletes the page from Notion.                                                                                                                                                       |

---

## 3\. Key Feature Requirements (MVP)

| Feature Category            | Description                                                                                                                                                 |
| :-------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Notion API Connection**   | Secure, two-way read/write connection to the user-specified Notion databases.                                                                               |
| **Streamer Task List**      | A dedicated UI section on the overlay that displays all items from the "Streamer Tasks" DB where `Status` is `false`.                                       |
| **Viewer Task List**        | A dedicated UI section that displays items from the "Viewer Tasks" DB where `Approval Status` is "Approved" and `Status` is `false`.                        |
| **Completed Task View**     | (Optional but recommended) A separate, small list showing the last 3-5 tasks marked `Complete`.                                                             |
| **Twitch Chat Integration** | A backend service (e.g., Node.js bot) that connects to the streamer's Twitch chat and parses commands.                                                      |
| **Moderation Queue**        | The "Pending" status in Notion acts as the moderation queue. Only tasks marked "Approved" are rendered on stream.                                           |
| **Visual Task State**       | Tasks display a visual checkbox (`[ ]` / `[x]`) and style (e.g., `line-through`) that directly reflects the `Status` property in Notion.                    |
| **Configuration**           | A simple way for the streamer to provide their Notion API Key and Database IDs (e.g., via a config file or query parameters in the OBS browser source URL). |

---

## 4\. Technical Implementation (MVP)

### 4.1 Frontend (The Overlay)

- **Type:** A web application (e.g., built with React/Vite, Vue, or Svelte).
- **Hosting:** Hosted as a static site (e.g., Vercel, Netlify, or even locally) and added to OBS as a Browser Source.
- **Function:**
  - Periodically polls a backend API (e.g., every 5-10 seconds) to fetch the current state of both Notion databases.
  - Renders the "Streamer" and "Viewer" lists based on the fetched data.
  - Applies visual styles for completed tasks.

### 4.2 Backend (The "Glue")

- **Type:** A lightweight server (e.g., Node.js with Express) or Serverless Functions.
- **Function:**
  1.  **Twitch Chat Bot:** Connects to Twitch chat (using `tmi.js` or similar) to listen for commands (`!task`, `!approve`, `!done`, etc.).
  2.  **Notion API Client:** Authenticates with the Notion API (using the streamer's provided token).
  3.  **API Endpoints:**
      - `GET /tasks`: An endpoint for the frontend overlay to poll. This endpoint fetches data from _both_ Notion DBs and returns a clean JSON object.
      - _Command Handling:_ When the chat bot receives a valid command, it calls the Notion API to create, update, or delete pages as defined in the user flows.

---

## 5\. Chat Commands (MVP)

| Command                       | User Role    | Action                                                                 |
| :---------------------------- | :----------- | :--------------------------------------------------------------------- |
| `!task [Task Title]`          | Viewer       | Submits a task to the "Pending" queue in the Notion "Viewer Tasks" DB. |
| `!done` or `!status complete` | Viewer       | Marks their _own_ approved task as complete (checks the box).          |
| `!undo` or `!status active`   | Viewer       | Marks their _own_ completed task as active (unchecks the box).         |
| `!approve [ViewerName]`       | Mod/Streamer | Changes a user's task `Approval Status` from "Pending" to "Approved".  |
| `!reject [ViewerName]`        | Mod/Streamer | Deletes a user's "Pending" task page from Notion.                      |
| `!donetask [ViewerName]`      | Mod/Streamer | Force-completes any viewer's task (checks the box).                    |
| `!removetask [ViewerName]`    | Mod/Streamer | Deletes any viewer's "Approved" task page from Notion.                 |

---

## 6\. User Interface (UI) and Design

- The overlay must be clean, transparent, and readable against game/desktop backgrounds.
- The UI will be split into at least two clear sections: "Streamer Tasks" and "Viewer Tasks".
- Each task item must display:
  1.  A visual checkbox (`[ ]` or `[x]`).
  2.  The task title.
  3.  For viewer tasks: The submitter's username (e.g., `(by @username)`).
- Completed tasks (`Status: true`) should be visually distinct:
  - Checkbox is `[x]`.
  - Task text has `text-decoration: line-through`.
  - (Optional) Task has a lower opacity.
- **Interaction Note:** For the MVP, all interactions (checking/unchecking) are handled via chat commands. The checkboxes on the overlay are _visual representations_ of the Notion data and are _not_ clickable.

---

## 7\. Future Considerations (Post-MVP)

- **Direct Click Interaction (Twitch Extension):** Rebuild the project as a Twitch Extension. This would allow viewers to _actually click_ the checkbox on their task directly on the Twitch video player, providing a much more intuitive experience than chat commands.
- **WebSockets:** Upgrade the `GET /tasks` polling system to a WebSocket connection for true real-time, instant updates on the overlay without polling.
- **Theming:** Allow the streamer to customize colors, fonts, and layout via the browser source URL (e.g., `.../overlay.html?theme=dark&color=blue`).
- **Streamer Task Management:** Add chat commands for the streamer to manage their _own_ list (e.g., `!addstreamtask`, `!donestreamtask`).
