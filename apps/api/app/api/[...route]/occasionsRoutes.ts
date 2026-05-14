import { getAccount } from '@gredice/storage';
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
    AdventCalendarDayAlreadyOpenedError,
    AdventCalendarDayNotYetAvailableError,
    getAdventCalendar2025Status,
    getAdventOccasionOverview,
    openAdventCalendar2025Day,
} from '../../../lib/occasions/advent2025';

const DEFAULT_TIMEZONE = 'Europe/Paris';

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
            description: 'Otvori današnji prozorčić',
        }),
        authValidator(['user', 'admin']),
        zValidator(
            'json',
            z.object({ day: z.number().int().min(1).max(ADVENT_TOTAL_DAYS) }),
        ),
        async (context) => {
            const { day } = context.req.valid('json');
            const { accountId, userId } = context.get('authContext');

            // Get user's timezone from their account settings
            const account = await getAccount(accountId);
            const timeZone = account?.timeZone ?? DEFAULT_TIMEZONE;

            try {
                const result = await openAdventCalendar2025Day({
                    accountId,
                    userId,
                    day,
                    timeZone,
                });
                return context.json({
                    message: `Dan ${day} je otvoren!`,
                    awards: result.payload.awards,
                    awardDescriptions: result.awardDescriptions,
                });
            } catch (error) {
                if (error instanceof AdventCalendarDayAlreadyOpenedError) {
                    return context.json(
                        {
                            message:
                                'Taj dan adventskog kalendara je već otvoren.',
                        },
                        409,
                    );
                }
                if (error instanceof AdventCalendarDayNotYetAvailableError) {
                    return context.json(
                        {
                            message: `Dan ${day} još nije dostupan. Dostupan od ${error.availableAt.toISOString()}.`,
                            availableAt: error.availableAt.toISOString(),
                        },
                        400,
                    );
                }
                console.error('Pogreška pri otvaranju adventskog dana:', error);
                return context.json(
                    {
                        message:
                            'Došlo je do pogreške pri otvaranju prozorčića.',
                    },
                    500,
                );
            }
        },
    );

export default app;
