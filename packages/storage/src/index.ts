import { sql } from '@vercel/postgres';
import { drizzle } from 'drizzle-orm/vercel-postgres';
import * as schema from './schema';

export const connection = sql;
export const storage = drizzle(sql, { schema });

export * from './schema';
export * from './repositories/plantsRepo';
export * from './repositories/attributeValuesRepo';
export * from './repositories/attributeDefinitionsRepo';
