# Testing Baseline

This project now has a working baseline for linting and automated tests.

## Commands

- `npm run lint` - run ESLint with flat config (`eslint.config.js`)
- `npm run lint:fix` - auto-fix lint issues when possible
- `npm test` - run all tests with Node's built-in test runner
- `npm run test:watch` - run tests in watch mode
- `npm run test:coverage` - run tests with coverage output

## Current Test Layout

- `tests/unit/*.test.js` for pure logic tests
- `tests/integration/*.test.js` for HTTP/integration smoke tests

## How to add proper backend tests

1. Keep pure helpers in `tests/unit` (fast, no network/database).
2. Add route-level integration tests in `tests/integration` with `supertest`.
3. Mock external systems (DB, Clerk, Arcjet) at integration boundary when needed.
4. For full E2E, add a separate suite that runs against a disposable test database.

## Suggested next tests (highest value)

1. `GET /health` and root route from real `app`.
2. Auth middleware behavior: missing/invalid/valid Clerk token.
3. Messaging API endpoints:
   - `/api/messaging/users`
   - `/api/messaging/conversation-with/:otherClerkId`
4. Socket event contract tests (`join_conversation`, `send_message`) in isolated integration environment.
