import winston from "winston";

// RENDER is checked alongside NODE_ENV/VERCEL_ENV because this repo's
// committed .env pins NODE_ENV=development for local dev, and there's no
// way to confirm from here whether Render's dashboard overrides it for the
// live deploy — RENDER is set unconditionally by Render on every instance,
// so this can't silently misdetect production as dev there.
const isProduction =
  process.env.NODE_ENV === "production" || process.env.VERCEL_ENV || Boolean(process.env.RENDER);

const transports = [];

// ✅ Only use file logging when running locally
if (!isProduction) {
  transports.push(
    new winston.transports.File({
      filename: "logs/error.log",
      level: "error",
    }),
    new winston.transports.File({
      filename: "logs/combined.log",
    }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    })
  );
} else {
  // ✅ In Vercel, log only to console
  transports.push(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
    })
  );
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: "quickhands-api" },
  transports,
});

export default logger;
