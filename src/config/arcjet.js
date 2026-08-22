import arcjet, { shield, detectBot } from "@arcjet/node";

const aj = arcjet({
  key: process.env.ARCJET_KEY,
  rules: [
    shield({ mode: "LIVE" }),
    // DRY_RUN, not LIVE: this API has no public web frontend — it's consumed
    // only by the client-app/freelance-app Expo/React Native mobile clients,
    // which will never present browser-style fingerprints (no "verified
    // browser" / "known good bot" signals to match against). Confirmed via
    // direct curl testing that LIVE mode 403-blocked legitimate mobile
    // traffic across several User-Agent strings. Real abuse protection here
    // is the per-role sliding-window rate limiter in security.middleware.js.
    // DRY_RUN still evaluates and reports via Arcjet telemetry, it just never
    // denies the request.
    detectBot({
      mode: "DRY_RUN",
      allow: [
        "CATEGORY:SEARCH_ENGINE",
        "CATEGORY:PREVIEW",
      ],
    }),
    // Per-route rate limits are managed in security.middleware.js.
    // The old global 5-req/2s window was too aggressive for a mobile app
    // that fires several concurrent requests on startup.
  ],
});

export default aj;