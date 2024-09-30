import { sql } from '@vercel/postgres';
import { drizzle } from 'drizzle-orm/vercel-postgres';
import { config } from 'dotenv';
import * as schema from './schema';

const isProduction = process.env.VERCEL_ENV === 'production';
if (!isProduction) {
    config({ path: '.env.development.local' });
}

export const storage = drizzle(sql, { schema });