# Project TODO List: Collaborative Notion Tasker

This file tracks the development tasks for the Twitch Extension, based on the initial code review and the PDD.

## High Priority: Code Review Refactors

These tasks address items from the code review and should be completed before building major new features.

- [x] **[ebs.js]** **Critical:** Update all user-related functions (`POST /tasks`, `findUserTask`, etc.) to consistently use the `opaque_user_id` as the unique identifier for viewers, not `username`.
- [x] **[ebs.js]** Ensure the Notion "Submitter" column is configured to store the `opaque_user_id` when a task is created via `POST /tasks`.
- [x] **[ebs.js]** Add input validation to the `POST /tasks` endpoint to sanitize `taskDescription` and prevent potential injection attacks.
- [x] **[ebs.js]** Correct the schema mismatch in `getTasksForOverlay` to use `"Status"` instead of `"State"` when querying for streamer tasks.
- [x] **[ebs.js]** Add `await` to the `updateDatabaseSchema` and `migrateDatabase` calls in the `initializeServer` function to prevent race conditions.
- [x] **[code.html]** Improve frontend error handling in `fetchTasks` to display a user-friendly "Could not load tasks" message on failure, rather than just logging to the console.
- [x] **[code.html]** Remove the redundant `updateCounterFromDOM` function and rely solely on `updateTaskCounter` for better performance.
- [x] **[ebs.js]** **Architecture:** Transition from using `.env` variables for database IDs to storing and retrieving them from the Twitch Configuration Service. This will better support multi-broadcaster setups.
- [ ] **[ebs.js]** **Architecture:** Replace `console.log` placeholders with actual calls to the Twitch Configuration Service to store and retrieve database IDs.

## Code Review Findings (Self-Identified)

- [x] **[code.html]** **Security (High Priority):** Refactor `renderStreamerTasks` and `renderViewerTasks` to use `document.createElement` and `.textContent` instead of `innerHTML` to prevent XSS vulnerabilities from malicious data in the Notion database.
- [x] **[config/databaseSchemas.js]** **Data Modeling:** The `VIEWER_SCHEMA`'s `Status` property contains redundant "Approved" and "Rejected" options that conflict with the `"Approval Status"` property. Simplify the `Status` property to only include states relevant to an approved task's lifecycle (e.g., "Not started", "In progress", "Done").
- [ ] **[ebs.js]** **Refactor:** The logic for fetching the broadcaster's configuration is duplicated across multiple endpoints (`/tasks`, `/tasks/me/complete`, etc.). This could be extracted into a middleware function to run after `verifyTwitchJWT` to reduce code duplication and streamline the request lifecycle.
- [x] **[ebs.js]** **Data Integrity:** The `findUserTask` function includes a fallback to query by the `Status` property. To ensure data consistency and prevent bugs, this fallback should be removed. The system should rely exclusively on `"Approval Status"` for moderation states.
- [ ] **[ebs.js]** **Security:** The `containsProhibited` function provides a very basic level of content moderation. This should be expanded with a more robust list of patterns or integrated with a third-party moderation service to better protect streamers and viewers.
- [ ] **[code.html]** **Performance:** The `onViewerCheckboxChange` function re-fetches all tasks after a single task's status changes. This is inefficient. Refactor to update the UI directly or only re-render the affected task.

## New Code Review Findings

- [ ] **Docstrings:** Add JSDoc comments to all functions in `ebs.js`, `code.html`, `config.js`, and `mock-ebs.js` to improve code clarity and maintainability.
- [x] **[config.js]** **Hardcoded URL:** The `createDatabases` function in `config.js` uses a hardcoded URL for the EBS. This should be updated to use a dynamic URL for production environments.
- [ ] **[ebs.js]** **Inadequate Content Moderation:** The `containsProhibited` function provides a very basic level of content moderation. This should be expanded with a more robust list of patterns or integrated with a third-party moderation service to better protect streamers and viewers.
- [ ] **[code.html]** **Inefficient Task Updates:** The `onViewerCheckboxChange` function re-fetches all tasks after a single task's status changes. This is inefficient. Refactor to update the UI directly or only re-render the affected task.
- [ ] **[ebs.js]** **Cache Invalidation:** The `getDataSourceId` function caches data source IDs but lacks a cache invalidation strategy. This could lead to issues if the database schema changes.
- [ ] **[code.html]** **Client-Side JWT Decoding:** The JWT is decoded on the client-side in `code.html` to determine the user's role. This is not a security risk, but it's not ideal. This logic should be moved to the backend.

## Phase 1: Core Backend & Read-Only Overlay

- [ ] **[code.html]** Build out the UI to fetch and render the `streamerTasks` and `viewerTasks` lists from the `GET /tasks` endpoint.
- [ ] **[code.html]** Style the overlay to be clean, readable, and respect the 3-task limit for the viewer list.

## Phase 2: Viewer Submission & Moderation

- [x] **[NEW FILE]** Create `panel.html` to serve as the Twitch Extension Panel.
- [x] **[panel.html]** Implement the `twitch.onAuthorized` auth flow, similar to the overlay.
- [x] **[panel.html]** Build a simple form (e.g., "Task Title") for task submission.
- [x] **[panel.html]** Add JavaScript to `panel.html` to send the new task data to the `POST /tasks` endpoint, including the auth token.
- [x] **[NEW FILE]** Create `config.html` to serve as the Twitch Live Config Panel for moderators/streamers.
- [x] **[ebs.js]** Create a new endpoint, e.g., `GET /tasks/pending`, that fetches tasks from the Viewer Notion DB with the "Pending" status (requires `verifyTwitchJWT` and a role check for 'moderator' or 'broadcaster').
- [x] **[config.html]** Implement auth and fetch logic to call `GET /tasks/pending` and display the list of tasks awaiting approval.
- [x] **[config.html]** Add "Approve" and "Reject" buttons for each task, which call the existing `PUT /tasks/:pageId/approve` endpoint (or a new `DELETE /tasks/:pageId` endpoint for rejection).

## Phase 3: Task Lifecycle & Progress Rewards

- [ ] **[panel.html]** Add a "My Task" view to the panel, which fetches and displays the user's currently "Approved" but incomplete task.
- [ ] **[panel.html]** Add a "Mark Complete" button to this view.
- [ ] **[ebs.js]** Create a new endpoint `PUT /tasks/complete` (or similar) that finds the user's active task (via their `opaque_user_id`) and marks its "Status" as complete in Notion.
- [ ] **[ebs.js]** Integrate the Twitch Configuration Service. On _any_ task completion (streamer or viewer), increment a `Progress_Points` value in the broadcaster's config segment.
- [ ] **[ebs.js]** Create a new _unauthenticated_ endpoint `GET /progress` that reads the `Progress_Points` from the Twitch Config Service (so the overlay can fetch it without a user JWT).
- [ ] **[code.html]** Build the "Focus Bar" UI element.
- [ ] **[code.html]** Add logic to periodically fetch from `GET /progress` and update the fill of the Focus Bar.
- [ ] **[ebs.js]** Add logic to the task completion endpoint to check if `Progress_Points` has crossed a Tier threshold (3, 7, 12).
- [ ] **[ebs.js]** If a Tier is met, use the Twitch API (with an App Access Token) to send an automated congratulatory chat message.
- [ ] **[code.html]** Add a simple CSS animation or visual cue that triggers when the progress bar hits a new Tier.

## Future (Post-MVP)

- [ ] Explore Channel Points integration for "Priority Tasks".
- [ ] Investigate a chat-bot component for `!stats` or viewer presence tracking.
