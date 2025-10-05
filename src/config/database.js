import 'dotenv/config';

import {neon} from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http';

const sq = neon(process.env.DATABASE_URL)

const db = drizzle(sql)

export { db, sql}