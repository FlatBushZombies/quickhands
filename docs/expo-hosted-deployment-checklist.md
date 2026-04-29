# Expo Hosted Deployment Checklist

Use this checklist when shipping `C:\Users\gamerrdotcom\Desktop\client-app` and `C:\Users\gamerrdotcom\Desktop\freelance-app` to Expo-hosted preview or production builds.

## Required environment variables

Both apps must have these values available in Expo-hosted builds:

- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_SOCKET_URL`

The backend should point to:

- `https://quickhands-api.vercel.app`

## Build-time compatibility checks

- `client-app` and `freelance-app` both use Expo Router, Clerk Expo, Expo Location, and Expo Notifications.
- The freelance app must keep `expo-notifications` aligned with Expo SDK 54.
- The freelance app must include `expo-location`, `expo-notifications`, and `expo-font` plugins in `app.json`.
- Hosted auth redirect should use the app root URL instead of a route-group path.

## Before publishing

1. Run `npx tsc --noEmit --pretty false` in both app directories.
2. Run `npx expo config --type public` in both app directories.
3. Confirm the resolved config includes:
   - the expected `scheme`
   - the expected `updates.url`
   - `expo-location`
   - `expo-notifications`
4. Build preview installs from EAS instead of relying only on localhost Metro.

## On-device smoke test

1. Open each app from the hosted build.
2. Confirm the splash screen appears and exits.
3. Confirm Google sign-in opens and returns to the app.
4. Confirm location permission is requested on startup.
5. Confirm the authenticated user reaches the home screen without a reload loop.
6. Confirm notification polling still loads notifications even if sockets are unavailable.

## Recent fixes covered by this checklist

- safer hosted auth redirect URL
- hosted-build config error screen instead of hard crash
- matching EAS build profiles for both apps
- corrected freelance notifications native module version
- required Expo plugin declarations restored for freelance preview builds
