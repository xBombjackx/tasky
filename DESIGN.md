# Design Document: Twitch Notion Task Overlay

## 1. System Overview

This document outlines the design of the Twitch Notion Task Overlay extension. The system is composed of three main components:

1.  **Frontend**: An HTML/JavaScript page (`video_overlay.html`) that is displayed on the Twitch livestream.
2.  **Backend (EBS)**: An Extension Backend Service (`ebs.js`) that handles business logic, communicates with the Notion API, and verifies Twitch JWTs.
3.  **Notion Databases**: Two databases that store tasks—one for the streamer and one for viewer submissions.

The frontend communicates with the EBS, which in turn communicates with the Notion API to fetch and manage tasks. All communication between the frontend and backend is secured using Twitch's JWTs.

## 2. Frontend

The frontend is a single HTML file (`video_overlay.html`) that contains the following:

-   **HTML Structure**: A basic structure to display the tasks.
-   **CSS Styling**: Basic styling to make the overlay readable.
-   **JavaScript Logic**:
    -   Includes the Twitch Extension Helper Library.
    -   Handles the Twitch `onAuthorized` callback to get a JWT and user information.
    -   Fetches tasks from the EBS and renders them on the overlay.
    -   Listens for context changes from the Twitch Extension Helper.

## 3. Backend (EBS)

The backend is a Node.js application using the Express framework. Its responsibilities include:

-   **API Endpoints**:
    -   `GET /tasks`: Fetches the current list of streamer and viewer tasks from Notion.
    -   `POST /tasks`: Allows viewers to submit new tasks.
    -   `PUT /tasks/:pageId/approve`: Allows moderators to approve viewer-submitted tasks.
-   **Twitch JWT Verification**: A middleware function that verifies the JWT on every incoming request to ensure it is from an authenticated Twitch user.
-   **Notion API Integration**: A set of helper functions to interact with the Notion API for creating, reading, and updating tasks.
-   **Environment Configuration**: Uses a `.env` file to manage sensitive information like API keys and database IDs.

## 4. Data Flow

1.  **Initialization**:
    -   The frontend is loaded on the Twitch stream.
    -   The Twitch Extension Helper library is initialized.
    -   The `onAuthorized` callback is triggered, providing a JWT to the frontend.

2.  **Fetching Tasks**:
    -   The frontend sends a `GET` request to the `/tasks` endpoint on the EBS, including the JWT in the `Authorization` header.
    -   The EBS verifies the JWT.
    -   The EBS queries the Notion API to get the list of tasks from both the streamer and viewer databases.
    -   The EBS returns the tasks as a JSON response to the frontend.
    -   The frontend renders the tasks in the overlay.

3.  **Submitting a Task (Viewer)**:
    -   A viewer submits a task through the extension's UI (not yet implemented in the current version).
    -   The frontend sends a `POST` request to the `/tasks` endpoint with the task description.
    -   The EBS verifies the JWT, creates a new task in the viewer Notion database with a "Pending" status.

4.  **Approving a Task (Moderator)**:
    -   A moderator approves a task through a separate interface (not yet implemented).
    -   A `PUT` request is sent to the `/tasks/:pageId/approve` endpoint.
    -   The EBS verifies the JWT and the user's role (moderator or broadcaster).
    -   The EBS updates the task's status to "Approved" in the Notion database.
