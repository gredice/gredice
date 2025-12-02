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

            try {
                const result = await openAdventCalendar2025Day({
                    accountId,
                    userId,
                    day,
                });
                return context.json({
                    poruka: `Dan ${day} je otvoren!`,
                    nagrade: result.payload.awards,
                    opisNagrada: result.opisNagrada,
                });
            } catch (error) {
                if (error instanceof AdventCalendarDayAlreadyOpenedError) {
                    return context.json(
                        {
                            poruka: 'Taj dan adventskog kalendara je već otvoren.',
                        },
                        409,
                    );
                }
                if (error instanceof AdventCalendarDayNotYetAvailableError) {
                    return context.json(
                        {
                            poruka: `Dan ${day} još nije dostupan. Dostupan od ${error.availableAt.toISOString()}.`,
                            dostupnoOd: error.availableAt.toISOString(),
                        },
                        400,
                    );
                }
                console.error('Pogreška pri otvaranju adventskog dana:', error);
                return context.json(
                    {
                        poruka: 'Došlo je do pogreške pri otvaranju prozorčića.',
                    },
                    500,
                );
            }
        },
    );

export default app;
