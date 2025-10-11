import app from "./app.js";
import { createServer } from 'http';
import { initSocket } from '#config/socket.js';

const PORT = process.env.PORT || 3000;

const server = createServer(app);

// Initialize WebSocket server
initSocket(server);

server.listen(PORT, () => {
    console.log(`Listening on http://localhost:${PORT}`);
});
