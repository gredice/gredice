import { getRaisedBed, getRaisedBedSensors } from '@gredice/storage';
import { Hono, type MiddlewareHandler } from 'hono';
import { describeRoute, validator as zValidator } from 'hono-openapi';
import { z } from 'zod';
import { authSecurity } from '../docs/security';
import { type AuthVariables, authValidator } from '../hono/authValidator';
import { readRaisedBedSensorHistory } from './readRaisedBedSensorHistory';

export function raisedBedSensorHistoryRoute(
    dependencies: {
        auth: (
            roles: string[],
        ) => MiddlewareHandler<{ Variables: AuthVariables }>;
        getRaisedBed: (
            id: number,
        ) => Promise<Pick<
            NonNullable<Awaited<ReturnType<typeof getRaisedBed>>>,
            'gardenId' | 'accountId'
        > | null>;
        getRaisedBedSensors: (
            id: number,
        ) => Promise<
            Pick<
                Awaited<ReturnType<typeof getRaisedBedSensors>>[number],
                'id' | 'sensorSignalcoId'
            >[]
        >;
    } = { auth: authValidator, getRaisedBed, getRaisedBedSensors },
) {
    return new Hono<{ Variables: AuthVariables }>().get(
        '/:gardenId/raised-beds/:raisedBedId/sensors/:sensorId/:type',
        describeRoute({
            description:
                'Get reading history for a sensor on an owned raised bed',
            security: authSecurity,
            responses: {
                200: {
                    description: 'Sensor history returned by the provider.',
                },
                400: { description: 'Invalid garden or raised bed ID.' },
                401: { description: 'Authentication required.' },
                404: { description: 'Raised bed or sensor not found.' },
                502: {
                    description:
                        'The sensor provider returned an error or invalid response.',
                },
                503: {
                    description:
                        'The sensor provider is temporarily unavailable.',
                },
            },
        }),
        zValidator(
            'param',
            z.object({
                gardenId: z.string(),
                raisedBedId: z.string(),
                sensorId: z.string(),
                type: z.string(),
            }),
        ),
        zValidator(
            'query',
            z.object({ duration: z.string().optional().default('5') }),
        ),
        dependencies.auth(['user', 'admin']),
        async (context) => {
            const { gardenId, raisedBedId, sensorId, type } =
                context.req.valid('param');
            const { duration } = context.req.valid('query');
            const gardenIdNumber = parseInt(gardenId, 10);
            if (Number.isNaN(gardenIdNumber)) {
                return context.json({ error: 'Invalid garden ID' }, 400);
            }
            const raisedBedIdNumber = parseInt(raisedBedId, 10);
            if (Number.isNaN(raisedBedIdNumber)) {
                return context.json({ error: 'Invalid raised bed ID' }, 400);
            }

            const { accountId } = context.get('authContext');
            const raisedBed =
                await dependencies.getRaisedBed(raisedBedIdNumber);
            if (
                !raisedBed ||
                raisedBed.gardenId !== gardenIdNumber ||
                raisedBed.accountId !== accountId
            ) {
                return context.json({ error: 'Raised bed not found' }, 404);
            }

            const sensors =
                await dependencies.getRaisedBedSensors(raisedBedIdNumber);
            const sensorIdNumber = parseInt(sensorId, 10);
            const sensor = sensors.find((s) => s.id === sensorIdNumber);
            if (!sensor?.sensorSignalcoId) {
                return context.json({ error: 'Sensor not found' }, 404);
            }

            context.header('Cache-Control', 'private, no-store');
            const history = await readRaisedBedSensorHistory(
                sensor.sensorSignalcoId,
                type,
                duration,
                context.req.raw.signal,
            );
            if (history.status) {
                return context.json(
                    { error: 'Sensor history unavailable' },
                    history.status,
                );
            }

            return context.json({
                id: sensor.id,
                type,
                values: history.values,
            });
        },
    );
}
