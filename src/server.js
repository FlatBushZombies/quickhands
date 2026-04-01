import app from "./app.js";
import { createServer } from 'http';
import { initSocket } from '#config/socket.js';
import logger from '#config/logger.js';

const PORT = process.env.PORT || 3000;

const server = createServer(app);
server.keepAliveTimeout = Number(process.env.KEEP_ALIVE_TIMEOUT_MS) || 65000;
server.headersTimeout = Number(process.env.HEADERS_TIMEOUT_MS) || 66000;
server.requestTimeout = Number(process.env.REQUEST_TIMEOUT_MS) || 120000;

// Initialize WebSocket server
initSocket(server);

server.listen(PORT, () => {
    logger.info(`Listening on http://localhost:${PORT}`);
});
