# Project TODO List: Collaborative Notion Tasker

This file tracks the development tasks for the Twitch Extension, based on the initial code review and the PDD.

## High Priority: Code Review Refactors

These tasks address items from the code review and should be completed before building major new features.

- [ ] **[ebs.js]** Update all user-related functions (`POST /tasks`, `findUserTask`, etc.) to consistently use the `opaque_user_id` as the unique identifier for viewers, not `username`.
- [ ] **[ebs.js]** Ensure the Notion "Submitter" column is configured to store the `opaque_user_id` when a task is created via `POST /tasks`.
- [ ] **[video_overlay.html]** Improve frontend error handling in `fetchTasks` to display a user-friendly "Could not load tasks" message on failure, rather than just the auth status.

## Phase 1: Core Backend & Read-Only Overlay

- [ ] **[video_overlay.html]** Build out the UI to fetch and render the `streamerTasks` and `viewerTasks` lists from the `GET /tasks` endpoint.
- [ ] **[video_overlay.html]** Style the overlay to be clean, readable, and respect the 3-task limit for the viewer list.

## Phase 2: Viewer Submission & Moderation

- [ ] **[NEW FILE]** Create `panel.html` to serve as the Twitch Extension Panel.
- [ ] **[panel.html]** Implement the `twitch.onAuthorized` auth flow, similar to the overlay.
- [ ] **[panel.html]** Build a simple form (e.g., "Task Title") for task submission.
- [ ] **[panel.html]** Add JavaScript to `panel.html` to send the new task data to the `POST /tasks` endpoint, including the auth token.
- [ ] **[NEW FILE]** Create `config.html` to serve as the Twitch Live Config Panel for moderators/streamers.
- [ ] **[ebs.js]** Create a new endpoint, e.g., `GET /tasks/pending`, that fetches tasks from the Viewer Notion DB with the "Pending" status (requires `verifyTwitchJWT` and a role check for 'moderator' or 'broadcaster').
- [ ] **[config.html]** Implement auth and fetch logic to call `GET /tasks/pending` and display the list of tasks awaiting approval.
- [ ] **[config.html]** Add "Approve" and "Reject" buttons for each task, which call the existing `PUT /tasks/:pageId/approve` endpoint (or a new `DELETE /tasks/:pageId` endpoint for rejection).

## Phase 3: Task Lifecycle & Progress Rewards

- [ ] **[panel.html]** Add a "My Task" view to the panel, which fetches and displays the user's currently "Approved" but incomplete task.
- [ ] **[panel.html]** Add a "Mark Complete" button to this view.
- [ ] **[ebs.js]** Create a new endpoint `PUT /tasks/complete` (or similar) that finds the user's active task (via their `opaque_user_id`) and marks its "Status" as complete in Notion.
- [ ] **[ebs.js]** Integrate the Twitch Configuration Service. On _any_ task completion (streamer or viewer), increment a `Progress_Points` value in the broadcaster's config segment.
- [ ] **[ebs.js]** Create a new _unauthenticated_ endpoint `GET /progress` that reads the `Progress_Points` from the Twitch Config Service (so the overlay can fetch it without a user JWT).
- [ ] **[video_overlay.html]** Build the "Focus Bar" UI element.
- [ ] **[video_overlay.html]** Add logic to periodically fetch from `GET /progress` and update the fill of the Focus Bar.
- [ ] **[ebs.js]** Add logic to the task completion endpoint to check if `Progress_Points` has crossed a Tier threshold (3, 7, 12).
- [ ] **[ebs.js]** If a Tier is met, use the Twitch API (with an App Access Token) to send an automated congratulatory chat message.
- [ ] **[video_overlay.html]** Add a simple CSS animation or visual cue that triggers when the progress bar hits a new Tier.

## Future (Post-MVP)

- [ ] Explore Channel Points integration for "Priority Tasks".
- [ ] Investigate a chat-bot component for `!stats` or viewer presence tracking.
