import 'dotenv/config';

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

const databaseUrl = process.env.DATABASE_URL;

const sql = neon(databaseUrl);
const db = drizzle(sql);

export { db, sql };
