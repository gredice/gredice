import {
    index,
    integer,
    pgTable,
    real,
    serial,
    text,
    timestamp,
} from 'drizzle-orm/pg-core';

export const weatherHistory = pgTable(
    'weather_history',
    {
        id: serial('id').primaryKey(),
        recordedAt: timestamp('recorded_at').notNull().defaultNow(),
        symbol: integer('symbol'),
        temperature: real('temperature'),
        rain: real('rain').notNull().default(0),
        windDirection: text('wind_direction'),
        windSpeed: real('wind_speed').notNull().default(0),
        rainy: real('rainy').notNull().default(0),
        snowy: real('snowy').notNull().default(0),
        cloudy: real('cloudy').notNull().default(0),
        foggy: real('foggy').notNull().default(0),
        thundery: real('thundery').notNull().default(0),
    },
    (table) => [index('weather_history_recorded_at_idx').on(table.recordedAt)],
);

export type InsertWeatherHistory = Omit<
    typeof weatherHistory.$inferInsert,
    'id' | 'recordedAt'
>;
export type SelectWeatherHistory = typeof weatherHistory.$inferSelect;
