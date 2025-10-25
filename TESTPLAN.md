# Test Plan: Notion Task Extension UI

This document outlines the plan for testing the user interface of the Notion Task Twitch Extension locally.

## 1. Overview & Goal

The primary goal of this test plan is to enable developers to reliably and efficiently test the frontend UI (`code.html`) in a local environment without needing to run the full Twitch Extension sandbox.

This involves:
- Isolating the frontend from the live Twitch API.
- Simulating the Extension Backend Service (EBS) to provide controlled data.
- Verifying that the UI correctly renders different states based on mock data.

## 2. Testing Approach: Mocking

We will use a **mocking** strategy to achieve local testing.

1.  **Mock the Twitch Extension Helper (`Twitch.ext`)**: The `code.html` file relies on a global `Twitch.ext` object provided by a script from `extension-files.twitch.tv`. We will create a local JavaScript file (`mock-twitch-ext.js`) to simulate this object and its key methods, specifically `onAuthorized()`.
2.  **Mock the Extension Backend Service (EBS)**: The frontend makes `fetch` requests to an EBS. We will create a simple mock server (`mock-ebs.js`) using Node.js and a library like `express` to intercept these requests and return predictable, static JSON data.

## 3. Step-by-Step Implementation

### Step 3.1: Create a Mock Twitch Helper

1.  **Create `mock-twitch-ext.js`**:
    -   This file will define a `window.Twitch` object with the same structure as the real one.
    -   It will include a mock `onAuthorized()` function that immediately invokes the callback with a hardcoded, sample `auth` object. This simulates a successful authentication as soon as the page loads.

    ```javascript
    // mock-twitch-ext.js
    window.Twitch = {
      ext: {
        onAuthorized: function (callback) {
          console.log("Mock Twitch: onAuthorized() called.");
          // Simulate successful authorization immediately
          setTimeout(() => {
            callback({
              token: "mock-jwt-token",
              userId: "123456789",
              channelId: "987654321",
            });
          }, 100); // Small delay to mimic async behavior
        },
        onContext: function (callback) {
          // Mock onContext if needed, otherwise leave empty
          console.log("Mock Twitch: onContext() called.");
        },
        // ... mock other functions as needed
      },
    };
    ```

2.  **Modify `code.html` for Local Testing**:
    -   We will add a query parameter check. If `?local=true` is in the URL, `code.html` will load `mock-twitch-ext.js` instead of the official Twitch script.
    -   The EBS URL will also be pointed to our local mock server.

    ```html
    <!-- In code.html -->
    <script>
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('local') === 'true') {
        // For local testing, use the mock EBS
        document.write('<script src="mock-twitch-ext.js"><\/script>');
        window.EBS_URL = "http://localhost:8082"; // Port for our mock server
      } else {
        // For production/Twitch sandbox
        document.write('<script src="https://extension-files.twitch.tv/helper/v1/twitch-ext.min.js"><\/script>');
        window.EBS_URL = "https://yummy-badgers-dream.loca.lt"; // Original EBS URL
      }
    </script>
    ```

    *Note: The actual implementation in `code.html` will need to be slightly different to correctly assign `EBS_URL` to the right scope, but this illustrates the principle.*

### Step 3.2: Create a Mock EBS Server

1.  **Create `mock-ebs.js`**:
    -   This will be a simple Node.js/Express server.
    -   It will listen on a specific port (e.g., `8082`).
    -   It will have one endpoint: `GET /tasks`.
    -   This endpoint will return a static, hardcoded JSON object that mimics the real API response from the actual `ebs.js`.

    ```javascript
    // mock-ebs.js
    const express = require('express');
    const cors = require('cors');
    const app = express();
    const PORT = 8082;

    app.use(cors());

    const mockTasks = {
      streamerTasks: [
        { id: 'st1', title: 'Finish the main story quest' },
        { id: 'st2', title: 'Defeat the secret boss' },
      ],
      viewerTasks: [
        { id: 'vt1', title: 'Use only a pistol for a round', submitter: 'viewer123' },
        { id: 'vt2', title: 'Do a barrel roll!', submitter: 'anotherViewer' },
      ],
    };

    app.get('/tasks', (req, res) => {
      console.log('Mock EBS: Received request for /tasks');
      res.json(mockTasks);
    });

    app.listen(PORT, () => {
      console.log(`Mock EBS server running on http://localhost:${PORT}`);
    });
    ```

2.  **Add Dependencies**:
    -   The `package.json` will need `express` and `cors` added to `devDependencies`.

### Step 3.3: Document the Test Process

We will add a section to `README.md` explaining how to run the UI tests.

1.  **Start the Mock Server**:
    ```bash
    node mock-ebs.js
    ```

2.  **Open the Frontend**:
    -   Open `code.html` in a web browser with the special query parameter:
        `file:///path/to/your/project/code.html?local=true`

3.  **Expected Outcome**:
    -   The page should load without errors.
    -   The "Connecting to Twitch..." message should be replaced by "Authenticated as user: 123456789".
    -   The UI should display the hardcoded streamer and viewer tasks from `mock-ebs.js`.

## 4. Test Cases

The following UI states can be verified using this method:

| Test Case                 | Mock Data Configuration in `mock-ebs.js`            | Expected UI Result                                                                 |
| ------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------- |
| **Happy Path**            | Both `streamerTasks` and `viewerTasks` have items.  | Both sections are populated with the correct task titles and submitter names.      |
| **No Viewer Tasks**       | `viewerTasks` is an empty array `[]`.               | The "Viewer Tasks" section appears but is empty.                                   |
| **No Streamer Tasks**     | `streamerTasks` is an empty array `[]`.             | The "Streamer Tasks" section appears but is empty.                                 |
| **No Tasks at All**       | Both arrays are empty.                              | Both sections are visible but contain no tasks.                                    |
| **Error from EBS**        | Modify `mock-ebs.js` to return a `500` status code. | The UI should display the "Error fetching tasks from backend" message.             |

By modifying the `mockTasks` object in `mock-ebs.js`, we can easily test all these scenarios and more without any external dependencies.
