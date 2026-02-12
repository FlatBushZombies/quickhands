import 'dotenv/config';
import app from '../src/app.js';
import { createServer } from 'http';
import { initSocket } from '../src/config/socket.js';

const server = createServer(app);

// Initialize Socket.IO
initSocket(server);

export default server;
