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

// Render's free tier spins the dyno down after ~15 min with no inbound
// traffic, and the next request pays a slow (sometimes failing) cold
// start — the confirmed cause of the intermittent "couldn't load
// notifications" / "couldn't load jobs" / job-posting failures on the
// installed Android apps. A GitHub Actions cron was added earlier to ping
// /health every 10 min, but scheduled Actions runs are best-effort and
// were observed running 30-80+ min apart in practice — well past the
// spin-down window. Self-pinging from inside the running process is
// reliable as long as the process is already up (a real setInterval, not
// a queued external scheduler), so it keeps the dyno warm far more
// consistently.
// RENDER_EXTERNAL_URL is supposed to be set automatically by Render, but
// that's not something this codebase controls or can verify from here, so
// it isn't trusted alone — falling back to the known production URL means
// this can't silently never activate if that var is ever missing/renamed.
// Gated on `RENDER` (also auto-set by Render on every instance, unlike
// NODE_ENV which this repo's committed .env pins to "development" and
// would otherwise wrongly suppress this in the real deployment) so local
// dev still never self-pings the real deploy.
const SELF_PING_URL = process.env.RENDER
  ? process.env.RENDER_EXTERNAL_URL || "https://quickhands-api.onrender.com"
  : null;
if (SELF_PING_URL) {
  const SELF_PING_INTERVAL_MS = 5 * 60 * 1000;
  setInterval(() => {
    fetch(`${SELF_PING_URL.replace(/\/$/, "")}/health`).catch((error) => {
      logger.warn("Self-ping keep-alive failed", { message: error.message });
    });
  }, SELF_PING_INTERVAL_MS).unref();
}

server.listen(PORT, () => {
    logger.info(`Listening on Port:${PORT}`);
});
