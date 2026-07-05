import arcjet, { shield, detectBot } from "@arcjet/node";

const aj = arcjet({
  key: process.env.ARCJET_KEY,
  rules: [
    shield({ mode: "LIVE" }),
    detectBot({
      mode: "LIVE",
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