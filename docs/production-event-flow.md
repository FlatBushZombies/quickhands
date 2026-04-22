# Production Event Flow

This backend and the two Expo apps now share one lightweight coordination model:

## What users see

- Freelancers receive nearby-job notifications when a client posts a task close to their detected area.
- Clients receive a notification when a freelancer applies.
- Freelancers receive notifications when a client accepts, rejects, or shares contact details.
- Both sides receive a notification when a communication tag is sent from the Messages tab.
- The Messages tab is no longer intended to be free-form chat. It is a tag timeline tied to a job application conversation.

## Communication tags

Communication tags are stored as regular conversation messages with the `QH_CARD::` prefix and JSON payload.

This keeps the system Vercel-safe because:

- it works over normal REST requests
- it does not require durable websocket sessions
- notifications can still be delivered through polling and optional sockets

## Startup location

Both apps request foreground location early through their root-level location providers.

That location is used to:

- sync the user record back to `/api/user/location`
- detect nearby jobs for freelancers
- attach client task location when creating jobs
- support "In your Area" notification copy and filtering

## Recommended verification after deploy

1. Redeploy the backend from `C:\Users\gamerrdotcom\Desktop\quickhands`.
2. Rebuild and reinstall the freelance Expo preview build because root startup behavior changed.
3. Run `npm run check:production-flows` in the backend.
4. In `C:\Users\gamerrdotcom\Desktop\client-app`, run `npx tsc --noEmit --pretty false`.
5. In `C:\Users\gamerrdotcom\Desktop\freelance-app`, run `npx tsc --noEmit --pretty false`.
6. Test this live flow:
   - sign in on both apps
   - allow location on startup
   - create a nearby client job
   - confirm freelancer sees the job and bell notification
   - apply from freelancer app
   - confirm client gets application notification
   - accept or reject from client app
   - confirm freelancer gets the status notification
   - open Messages on either side and send a tag
   - confirm the other side gets a communication notification and unread badge
