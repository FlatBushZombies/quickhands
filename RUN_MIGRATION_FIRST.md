# 🚨 RUN THIS MIGRATION FIRST! 🚨

Before testing the new features, you **MUST** add the new columns to your database.

## Step-by-Step Instructions

### Option 1: Neon Dashboard (Easiest)

1. Go to https://console.neon.tech
2. Log in to your account
3. Select your QuickHands project
4. Click **"SQL Editor"** in the left sidebar
5. Copy and paste this SQL:

```sql
ALTER TABLE job_applications
ADD COLUMN IF NOT EXISTS quotation TEXT,
ADD COLUMN IF NOT EXISTS conditions TEXT;
```

6. Click **"Run"** button
7. You should see success message: "ALTER TABLE"

### Option 2: Using psql CLI

If you have PostgreSQL client installed:

```bash
psql "your-neon-connection-string-here" -c "ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS quotation TEXT, ADD COLUMN IF NOT EXISTS conditions TEXT;"
```

### Option 3: Use the Migration File

```bash
cd C:\Users\gamerrdotcom\Desktop\quickhands
psql "your-neon-connection-string-here" -f migrations/add_quotation_conditions.sql
```

## Verify Migration Succeeded

Run this query in Neon SQL Editor:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'job_applications';
```

You should see `quotation` and `conditions` in the results!

## After Migration

Once migration is complete:
1. Deploy backend to Vercel (or it will auto-deploy if connected to GitHub)
2. Test the application flow
3. Check `DEPLOYMENT_GUIDE.md` for full testing instructions

## Need Help?

If you get an error:
- Make sure you're connected to the correct database
- Check that the `job_applications` table exists
- Verify you have ALTER TABLE permissions

The `IF NOT EXISTS` clause makes it safe to run multiple times!
