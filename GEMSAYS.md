## 1\. High Priority: Architecture & Multi-Broadcaster Support

This is the most significant area for feedback. The `TODO.md` file correctly
identifies the goal of moving to the Twitch Configuration Service to support
multiple broadcasters. However, the current code has several major blockers and
a conflicting implementation.

### **Finding (New): Global Notion Client**

- **Issue:** In `ebs.js`, the Notion `Client` is instantiated _once_ at the
  global level using the `NOTION_API_KEY` from `process.env`.
- **Impact:** This is the single biggest blocker to multi-broadcaster support.
  Every single API request from _any_ broadcaster (for getting tasks, posting
  tasks, or approving them) will use the _EBS owner's_ Notion credentials. This
  will not work.
- **Suggestion:** The Notion client must be instantiated _per request_ (or
  cached per-channel). You will need to:
  1.  In `verifyTwitchJWT`, get the `channel_id`.
  2.  Use that `channel_id` to fetch that broadcaster's specific, encrypted
      Notion key from your configuration store.
  3.  Decrypt the key.
  4.  Create a _new_ Notion client:
      `const notion = new Client({ auth: broadcasterNotionKey });`.
  5.  Pass this `notion` instance to all your helper functions
      (`getTasksForOverlay`, `addViewerTask`, etc.).

### **Finding (Conflict w/ TODO): `configStore.js` vs. Twitch Config Service**

- **Issue:** The `TODO.md` file has an item to "transition... to storing and
  retrieving them from the Twitch Configuration Service". However, the new
  `configStore.js` file implements a _local file system store_ instead, saving
  configs to a `data/` directory.
- **Impact:** This is a major issue for any production deployment. On many
  hosting platforms (like Heroku or serverless functions), the file system is
  ephemeral. Any saved configurations will be _wiped out_ when the server
  restarts or scales.
- **Suggestion:** I strongly recommend following the `TODO.md` item. The local
  file-based `configStore.js` should be refactored to read/write to the **Twitch
  Configuration Service** instead. Your encryption logic in `configStore.js` is
  great and can be reused to store the encrypted Notion key in the config
  service's "secret" segment.

### **Finding (New - Critical Security): `data/` Directory Not Ignored**

- **Issue:** The `configStore.js` saves files with encrypted, sensitive Notion
  keys to the `data/` directory. This `data/` directory is **not** listed in
  your `.gitignore` file.
- **Impact:** This creates a very high risk of accidentally committing sensitive
  broadcaster configuration files (containing their Notion keys) to source
  control.
- **Suggestion:** Add `data/` to your `.gitignore` file immediately.

### **Finding (New): Competing Config Systems**

- **Issue:** You currently have two different config systems.
  1.  `configStore.js`: A new, per-channel system that `setupRoutes.js` uses.
  2.  `configManager.js`: An old, global system that `ebs.js` (in the old
      `/setup` endpoint) uses.
- **Impact:** This is confusing and leads to bugs. For example, `setupRoutes.js`
  (the new system) has logic that _still_ checks the old global environment
  variables, which could cause broadcasters to accidentally share databases.
- **Suggestion:** Deprecate and remove `configManager.js` and
  `config/config.json`. Standardize fully on the `configStore.js` (or its Twitch
  Config Service replacement) and remove all logic from `setupRoutes.js` that
  checks the global `.env` database IDs.

---

## 2\. Backend & API (`ebs.js`)

### **Finding (New): Disconnected Per-Channel Logic**

- **Issue:** Your API endpoints (like `GET /tasks` and `POST /tasks`) correctly
  get the `channelId` and `opaque_user_id` from the JWT. However, the helper
  functions they call (`getTasksForOverlay`, `addViewerTask`) do _not_ accept
  `channelId` as a parameter.
- **Impact:** The helper functions fall back to using the global `notion` client
  and the global `.env` database IDs. This means the per-channel information is
  gathered but then thrown away.
- **Suggestion:** Refactor the helper functions to accept the `channelId` and
  the `notion` client instance as parameters.
  - `async function getTasksForOverlay(notion, streamerDbId, viewerDbId)`
  - `async function addViewerTask(notion, viewerDbId, submitterId, taskDescription)`
  - The endpoint handler will be responsible for getting the `notion` client and
    DB IDs from the config store using the `channelId`.

### **Finding (New): Unused/Legacy Code**

- **Issue:** The entire block of helper functions from lines 230-307
  (`getDataSourceId`, `findUserTask`, `approveViewerTask`, `rejectViewerTask`,
  `updateViewerTaskStatus`) does not appear to be called by any of your API
  endpoints.
- **Impact:** This code is likely legacy and is confusing. For example, the
  `PUT /tasks/:pageId/approve` endpoint correctly (and more simply) updates the
  page by its ID, it doesn't use the `approveViewerTask(username)` helper.
- **Suggestion:** Remove this block of unused code to simplify the file.

### **Finding (Conflict w/ TODO): "Submitter" vs. "Suggested by"**

- **Issue:** The `TODO.md` file says, "Ensure the Notion 'Submitter' column is
  configured...".
- **Conflict:** Your schema file `databaseSchemas.js`, your test plan
  `TESTPLAN.md`, and your `addViewerTask` function all use the column name
  `"Suggested by"`.
- **Suggestion:** The TODO item is likely incorrect. You should probably stick
  with `"Suggested by"` since all your code and documentation already use it.
  You can resolve this by updating the TODO item to reflect the actual column
  name.

### **Finding (Matches TODO): Missing `await`**

- I can confirm your TODO item is correct: The calls to `updateDatabaseSchema`
  and `migrateDatabase` in `initializeServer` are missing `await`. This will
  cause a race condition where the server starts listening before the database
  migration is complete.

---

## 3\. Frontend & Security (`code.html`)

### **Finding (New - Security): XSS Vulnerability**

- **Issue:** In `code.html`, the `renderStreamerTasks` and `renderViewerTasks`
  functions use `.innerHTML` to render task titles and submitter names that come
  from the API.
- **Impact:** Your `TODO.md` file correctly identifies the need to sanitize
  `taskDescription` on the _backend_. However, the frontend should also protect
  itself. If a malicious task title like `<img src=x onerror=alert('XSS')>` gets
  into your database, it _will_ execute in the overlay.
- **Suggestion:** **Never use `.innerHTML` with un-trusted data.** Instead,
  create elements and set their `.textContent`. This property is not parsed as
  HTML and automatically sanitizes the content.
  - **Instead of:** `el.innerHTML = \`\<p\>${task.title}\</p\>\`\`
  - **Do this:**
    ```javascript
    const p = document.createElement("p");
    p.textContent = task.title; // This is safe!
    el.appendChild(p);
    ```

### **Finding (Matches TODO): Redundant Task Counter**

- I can confirm your TODO item `Remove the redundant updateCounterFromDOM` is
  correct.
- **Additional Context:** This is not just redundant, it creates a poor user
  experience. When a user checks a box, the counter updates locally from the
  DOM. But this change isn't saved to the backend. The next time `fetchTasks`
  runs, the API will report the task as _incomplete_, and the checkbox will
  uncheck itself, and the counter will revert.
- **Suggestion:** As the TODO implies, remove `updateCounterFromDOM`. The _next_
  step (part of your Phase 3) would be to make the `onchange` event on the
  checkbox trigger a `PUT` request to the backend to actually complete the task.

### **Finding (Matches TODO): Frontend Error Handling**

- This matches your TODO item: The `catch` block in `fetchTasks` only logs to
  the console. This should be updated to show a user-friendly message in the UI.

---

## 4\. Schema & Documentation

### **Finding (Conflict w/ TODO): "State" vs. "Status" Confusion**

- **Issue:** The `TODO.md` says: "Correct the schema mismatch in
  `getTasksForOverlay` to use `"Status"` instead of `"State"`".
- **Conflict:** `getTasksForOverlay` _is_ using `State`, but your
  `config/databaseSchemas.js` file _defines_ the property as `State` for the
  `STREAMER_SCHEMA`. However, your `TESTPLAN.md` says the streamer schema should
  have a `Status` column.
- **Suggestion:** This indicates your documentation and your schema definition
  file are out of sync. You need to decide on one name. If the name should be
  "Status", you must:
  1.  Update `config/databaseSchemas.js` to change `State` to `Status`.
  2.  Then, update `getTasksForOverlay` in `ebs.js` to _also_ use `Status`.
  3.  This makes the TODO item more precise: the fix is needed in _both_ the
      schema definition and the query logic.
