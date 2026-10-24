import {
    getPendingDeliveryReadyEmailRequestIds,
    markDeliveryReadyEmailsProcessed,
} from '@gredice/storage';
import type { NextRequest } from 'next/server';
import { drainHourlyQueue } from '../../../../../lib/cron/drainHourlyQueue';
import { sendBatchedDeliveryReadyEmails } from '../../../../../lib/delivery/emailNotifications';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const BATCH_DELAY_MINUTES = 10;
const MAX_REQUESTS_PER_RUN = 200;

export async function GET(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    const secret = process.env.CRON_SECRET?.trim();
    if (!secret || authHeader !== `Bearer ${secret}`) {
        return new Response('Unauthorized', {
            status: 401,
        });
    }

    const readyBefore = new Date(Date.now() - BATCH_DELAY_MINUTES * 60 * 1000);
    const drained = await drainHourlyQueue({
        runBatch: async () => {
            const pendingRequests =
                await getPendingDeliveryReadyEmailRequestIds({
                    readyBefore,
                    limit: MAX_REQUESTS_PER_RUN,
                });
            const result =
                await sendBatchedDeliveryReadyEmails(pendingRequests);

            for (const group of result.processedGroups) {
                await markDeliveryReadyEmailsProcessed({
                    readyEvents: group.readyEvents,
                    recipients: group.recipients,
                    batchRequestIds: group.readyEvents.map(
                        (event) => event.requestId,
                    ),
                    completed: group.completed,
                    skipped: group.skipped,
                });
            }

            return { candidates: pendingRequests.length, ...result };
        },
        // Partial recipient failures remain queued for the next recovery pass.
        shouldContinue: (batch) =>
            batch.candidates === MAX_REQUESTS_PER_RUN &&
            batch.processedGroups.every(
                (group) => group.completed || group.skipped,
            ) &&
            batch.processedGroups.reduce(
                (count, group) => count + group.readyEvents.length,
                0,
            ) === batch.candidates,
    });
    const result = {
        candidates: drained.results.reduce(
            (total, batch) => total + batch.candidates,
            0,
        ),
        emailsSent: drained.results.reduce(
            (total, batch) => total + batch.emailsSent,
            0,
        ),
        groupsSent: drained.results.flatMap((batch) => batch.groupsSent),
        processedGroups: drained.results.flatMap(
            (batch) => batch.processedGroups,
        ),
    };
    return Response.json(
        {
            success: !drained.capacityReached,
            capacityReached: drained.capacityReached,
            candidates: result.candidates,
            emailsSent: result.emailsSent,
            groupsSent: result.groupsSent.length,
            requestsMarkedProcessed: result.processedGroups.reduce(
                (total, group) => total + group.readyEvents.length,
                0,
            ),
            requestsMarkedSent: result.groupsSent.reduce(
                (total, group) => total + group.requestIds.length,
                0,
            ),
            skipped: result.processedGroups.reduce(
                (total, group) =>
                    group.skipped ? total + group.readyEvents.length : total,
                0,
            ),
        },
        { status: drained.capacityReached ? 503 : 200 },
    );
}
