# Vercel Deployment Guide

## ⚠️ IMPORTANT LIMITATION

**Socket.IO has limited support on Vercel's serverless platform.** This is a fundamental architectural issue:

- ✅ Vercel uses **serverless functions** (stateless, short-lived)
- ❌ Socket.IO requires **persistent connections** (stateful, long-lived)
- ⚠️ Each request may go to a **different serverless instance**
- ⚠️ WebSocket connections will be **unreliable or fail entirely**
- ⚠️ Even polling transport may have issues with connection persistence

## Current Configuration

The following files have been added/updated to support Socket.IO on Vercel:

### 1. `/api/index.js`
- Serverless entry point for Vercel
- Exports the HTTP server with Socket.IO attached

### 2. `/vercel.json`
- Routes all traffic (including `/socket.io/*`) to the serverless function
- Configures Vercel to use `@vercel/node` builder

### 3. `/src/config/socket.js`
- Updated with:
  - `transports: ['polling', 'websocket']` - Tries polling first
  - Extended timeouts and intervals
  - Proper CORS configuration

## Deployment Steps

1. **Commit all changes:**
   ```bash
   git add .
   git commit -m "Add Vercel configuration for Socket.IO support"
   git push
   ```

2. **Redeploy on Vercel:**
   - Vercel should auto-deploy when you push to your main branch
   - Or manually trigger a deployment from the Vercel dashboard

3. **Set environment variables in Vercel:**
   - `CLIENT_ORIGIN` - Your client app URLs (comma-separated if multiple)
   - Any database credentials
   - Clerk API keys
   - Other secrets from your `.env` file

## Testing After Deployment

After deploying, monitor your browser console for:
- `[Socket] Connected` - Success!
- `[Socket] Connection error: timeout` - Connection issues
- `404 (Not Found)` - Routing issues (should be fixed now)

## Recommended Alternatives

For production-ready real-time functionality, consider:

### Option 1: Different Hosting Platform (Recommended)
- **Railway** - <https://railway.app> - Great Node.js support, persistent servers
- **Render** - <https://render.com> - Free tier, supports WebSockets
- **Fly.io** - <https://fly.io> - Global edge deployment
- **AWS EC2/ECS** - Full control, but more complex
- **DigitalOcean App Platform** - Simple deployment, WebSocket support

### Option 2: Managed Real-Time Services
Replace Socket.IO with a managed service:
- **Pusher** - <https://pusher.com> - Easy integration, free tier
- **Ably** - <https://ably.com> - Robust, scalable
- **Supabase Realtime** - <https://supabase.com> - If you're using Postgres
- **Firebase Cloud Messaging** - For mobile push notifications

### Option 3: Hybrid Approach
- Keep your REST API on Vercel
- Host only the Socket.IO server elsewhere (Railway/Render)
- Update client apps to connect to the separate WebSocket URL

## Migration Example (Railway)

If you decide to move to Railway:

1. Create account at <https://railway.app>
2. Create new project from GitHub repo
3. Railway will auto-detect Node.js and deploy
4. Set environment variables in Railway dashboard
5. Update client apps with new Railway URL
6. Deploy!

## Current Status

✅ Files configured for Vercel deployment
⚠️ May experience intermittent connection issues
❌ Not recommended for production without testing

Test thoroughly and monitor error rates!
