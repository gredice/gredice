import { Hono } from 'hono';
import { describeRoute, validator as zValidator } from 'hono-openapi';
import { z } from 'zod';
import {
    type AuthVariables,
    authValidator,
} from '../../../lib/hono/authValidator';
import {
    ADVENT_CALENDAR_2025_ID,
    ADVENT_TOTAL_DAYS,
    getAdventCalendar2025Status,
    getAdventOccasionOverview,
} from '../../../lib/occasions/advent2025';

const app = new Hono<{ Variables: AuthVariables }>()
    .get(
        '/',
        describeRoute({
            description: 'Popis prigoda',
        }),
        (context) =>
            context.json({
                prigode: [getAdventOccasionOverview()],
            }),
    )
    .get(
        '/advent',
        describeRoute({
            description: 'Osnovne informacije o adventu',
        }),
        (context) => context.json(getAdventOccasionOverview()),
    )
    .get(
        `/advent/${ADVENT_CALENDAR_2025_ID}`,
        describeRoute({
            description: 'Status adventskog kalendara 2025',
        }),
        authValidator(['user', 'admin']),
        async (context) => {
            const { accountId } = context.get('authContext');
            const status = await getAdventCalendar2025Status(accountId);
            return context.json(status);
        },
    )
    .post(
        `/advent/${ADVENT_CALENDAR_2025_ID}/open`,
        describeRoute({
            description:
                'Historical Advent 2025 award mutation. The campaign is closed and this endpoint no longer performs writes.',
        }),
        authValidator(['user', 'admin']),
        zValidator(
            'json',
            z.object({ day: z.number().int().min(1).max(ADVENT_TOTAL_DAYS) }),
        ),
        (context) =>
            context.json(
                {
                    code: 'ADVENT_CALENDAR_CLOSED',
                    message: 'Adventski kalendar 2025 je zatvoren.',
                },
                410,
            ),
    );

export default app;
