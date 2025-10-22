You are absolutely right, it is very confusing. The settings are split across different pages and the naming isn't intuitive.

Here is a README file you can save for your project. It explains all the moving parts, what each URL is for, and exactly where to put them.

-----

# Project Tasky: Twitch Extension README

This guide explains the local development workflow for the Twitch Extension, focusing on the confusing URL configuration.

## The Two-Server Problem

To test an extension locally, you are running **two separate servers** that must talk to each other. Twitch's servers also need to know where to find them.

1.  **Frontend Server (Your HTML/JS)**

      * **File:** `extension/video_overlay.html`
      * **Purpose:** This is the visual overlay that viewers see on Twitch. It's just a static HTML file.
      * **Local Server:** You must run a simple web server (like `http-server` or VS Code's "Live Server") to serve your `extension` directory.
      * **Tunnel URL (Example):** `https://weak-states-wash.loca.lt`

2.  **Backend Server (Your EBS - Extension Backend Service)**

      * **File:** `extension/ebs.js`
      * **Purpose:** This is your secure API. It handles JWT verification and talks to the Notion database. It runs on `localhost:8081`.
      * **Tunnel URL (Example):** `https://yummy-badgers-dream.loca.lt`

Your **Frontend** (loaded by Twitch from its tunnel) needs to `fetch` data from your **Backend** (running on its tunnel).

## Local Development Workflow

1.  **Terminal 1 (Backend):** Run your EBS server.

    ```bash
    node extension/ebs.js
    # Output: [EBS] Extension Backend Service listening on http://localhost:8081
    ```

2.  **Terminal 2 (Frontend):** Run a simple HTTP server for your static files.

    ```bash
    # Example using http-server, serving the parent directory
    # Make sure 'extension/video_overlay.html' is accessible
    npx http-server . -p 8080 
    ```

3.  **Terminal 3 (Backend Tunnel):** Expose your EBS (port 8081).

    ```bash
    npx localtunnel --port 8081 --subdomain yummy-badgers-dream
    # URL: https://yummy-badgers-dream.loca.lt
    ```

4.  **Terminal 4 (Frontend Tunnel):** Expose your HTML server (port 8080).

    ```bash
    npx localtunnel --port 8080 --subdomain weak-states-wash
    # URL: https://weak-states-wash.loca.lt
    ```

## Twitch Console Configuration: Where All the URLs Go

You have to configure **3 separate locations**.

-----

### Location 1: Frontend HTML (Asset Hosting)

This tells Twitch where to *find and load* your `video_overlay.html` file.

  * **Where to find it:** Twitch Console -\> Your Extension -\> **"Versions"** tab -\> Click your version (e.g., "0.0.1") -\> **"Asset Hosting"** tab.
  * **What to set:**
      * **Testing Base URI:** The *root* of your frontend tunnel.
          * **Value:** `https://weak-states-wash.loca.lt/` (Note the trailing slash `/`)
      * **Video - Overlay HTML File Path:** The *relative path* from the Base URI to your HTML file.
          * **Value:** `extension/video_overlay.html`

**Result:** Twitch will look for your overlay at `https://weak-states-wash.loca.lt/` + `extension/video_overlay.html`.

-----

### Location 2: Backend API (Security Whitelist)

This tells Twitch to *allow* your frontend to make `fetch()` requests to your backend. It's a security (CSP) setting.

  * **Where to find it:** Twitch Console -\> Your Extension -\> **"Settings"** tab -\> **"Capabilities"** tab.
  * **What to set:**
      * **Allowlist for URL Fetching Domains:** Add your backend tunnel's base URL to this list.
          * **Value to add:** `https://yummy-badgers-dream.loca.lt`

**Result:** Your frontend, loaded from `weak-states-wash.loca.lt`, is now granted permission to make API calls to `yummy-badgers-dream.loca.lt`.

-----

### Location 3: Frontend Code (Your HTML File)

Your own HTML code needs to know the URL of your backend.

  * **Where to find it:** In your code editor, open `extension/video_overlay.html`.
  * **What to set:**
      * **`const EBS_URL`:** This JavaScript constant must match your backend tunnel URL.
          * **Value:** `const EBS_URL = 'https://yummy-badgers-dream.loca.lt';`

**Result:** When your `fetchTasks()` function runs, it knows to send its request to the correct backend server.

-----

## Configuration Summary

| URL / Path | What is it? | Where does it go? |
| :--- | :--- | :--- |
| `https://weak-states-wash.loca.lt/` | **Frontend Tunnel (Root)** | Twitch Console -\> Versions -\> Asset Hosting -\> **Testing Base URI** |
| `extension/video_overlay.html` | **Frontend HTML (Path)** | Twitch Console -\> Versions -\> Asset Hosting -\> **Video - Overlay HTML File Path** |
| `https://yummy-badgers-dream.loca.lt` | **Backend Tunnel (API)** | 1. Twitch Console -\> Settings -\> Capabilities -\> **Allowlist for URL Fetching** <br> 2. Your Code -\> `video_overlay.html` -\> `const EBS_URL` |