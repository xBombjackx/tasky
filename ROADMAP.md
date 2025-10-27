# Project Roadmap

This document outlines the development roadmap for the project, organized into phases. Each phase builds upon the previous one, with the goal of creating a secure, performant, and user-friendly application.

## Phase 1: MVP - Core Functionality & Security Fixes

This phase focuses on addressing critical issues to ensure the application is functional and secure for a minimum viable product (MVP) release.

- **Fix Hardcoded Localhost URL:** Replace the hardcoded `localhost` URL in `config.js` with a relative path or environment variable to ensure the setup process works in production.
- **Generate `package-lock.json`:** Create and commit a `package-lock.json` file to ensure consistent dependency versions across all environments.
- **Add Environment Variable Documentation:** Create an `.env.example` file to document the required environment variables for easier setup.
- **Improve Setup Process:** Streamline the setup process in `config.html` to be more user-friendly and less error-prone.

## Phase 2: Hardening & Performance Optimization

This phase focuses on improving the security posture and performance of the application.

- **Implement Input Validation and Sanitization:** Add robust input validation and sanitization in `ebs.js` to prevent injection attacks.
- **Enhance JWT Security:** Strengthen JWT validation by including checks for `aud` (audience) and `iss` (issuer) claims.
- **Optimize `findUserTask` Function:** Refactor the `findUserTask` function in `ebs.js` to reduce the number of database queries and improve performance.
- **Standardize Error Handling:** Implement a centralized error-handling middleware in `ebs.js` to ensure consistent error handling.

## Phase 3: Automation & User Experience Enhancements

This phase focuses on improving maintainability through automated testing and enhancing the user experience with real-time features.

- **Introduce Automated Testing:** Set up a testing framework and add unit, integration, and end-to-end tests to ensure code quality and prevent regressions.
- **Refactor for Maintainability:** Refactor `ebs.js` to eliminate redundant code and improve modularity.
- **Optimize Frontend Data Fetching:** Cache task data on the frontend to reduce unnecessary API calls and improve responsiveness.
- **Implement Real-Time Updates:** Add a real-time update mechanism (e.g., WebSockets) to keep the frontend synchronized with the backend.

## Future

This section will be populated with future ideas and feature requests as the project evolves.
