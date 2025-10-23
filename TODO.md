# TODO - Code Review Findings (Extension-focused)

## `extension/ebs.js`
- [ ] **Security**: The `TWITCH_EXTENSION_SECRET` is a critical credential and should be handled with care. The current implementation correctly uses environment variables, which is good. However, there's no input validation on the `taskDescription` from the request body, which could lead to potential injection attacks.
- [ ] **Error Handling**: The error handling is basic. While it catches errors, it often returns a generic "Internal server error." message. It would be better to have more specific error messages for different failure scenarios (e.g., "Failed to connect to Notion API," "Invalid task data").
- [ ] **Code Duplication**: There's a lot of duplicated code in the Notion helper functions. For example, `approveViewerTask`, `rejectViewerTask`, and `updateViewerTaskStatus` all call `findUserTask`. This could be refactored to reduce redundancy.
- [ ] **Hardcoded Values**: The `PORT` is hardcoded to `8081` as a fallback. While this is a common port for extension backends, it would be better to make it configurable.

## `extension/video_overlay.html`
- [ ] **Hardcoded URL**: The `EBS_URL` is hardcoded. This makes it difficult to switch between different environments (e.g., development, testing, production). It would be better to fetch this from a configuration endpoint or have a build process that injects the correct URL.
- [ ] **Missing Viewer Tasks**: The code has a `TODO` to render viewer tasks, but this is not implemented. This is a key feature that needs to be completed.
- [ ] **No User Feedback**: When a user submits a task, there's no feedback in the UI to let them know if it was successful. The same is true for moderators approving tasks.
- [ ] **Styling**: The styling is very basic. While functional, it could be improved to provide a better user experience.
