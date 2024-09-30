import { sql } from '@vercel/postgres';
import { drizzle } from 'drizzle-orm/vercel-postgres';
import { config } from 'dotenv';
import * as schema from './schema';

config({ path: '.env.development.local' });

export const storage = drizzle(sql, { schema });