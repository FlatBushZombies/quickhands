import app from "./app.js";
import { createServer } from 'http';
import { initSocket } from '#config/socket.js';
import logger from '#config/logger.js';

const PORT = process.env.PORT || 3000;

// Without these, a single unawaited rejection anywhere (a fire-and-forget
// notification send, an unguarded .then chain, etc.) crashes the entire
// Node process on modern Node versions — taking down every other in-flight
// request for both apps until Render restarts the dyno. Log and keep
// serving instead; per-request try/catch is still the primary defense.
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', error);
});

const server = createServer(app);
server.keepAliveTimeout = Number(process.env.KEEP_ALIVE_TIMEOUT_MS) || 65000;
server.headersTimeout = Number(process.env.HEADERS_TIMEOUT_MS) || 66000;
server.requestTimeout = Number(process.env.REQUEST_TIMEOUT_MS) || 120000;

// Initialize WebSocket server
initSocket(server);

server.listen(PORT, () => {
    logger.info(`Listening on Port:${PORT}`);
});
