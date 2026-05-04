import {
    getPendingDeliveryReadyEmailRequestIds,
    markDeliveryReadyEmailsProcessed,
} from '@gredice/storage';
import type { NextRequest } from 'next/server';
import { sendBatchedDeliveryReadyEmails } from '../../../../../lib/delivery/emailNotifications';

export const dynamic = 'force-dynamic';

const BATCH_DELAY_MINUTES = 10;
const MAX_REQUESTS_PER_RUN = 200;

export async function GET(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new Response('Unauthorized', {
            status: 401,
        });
    }

    const readyBefore = new Date(Date.now() - BATCH_DELAY_MINUTES * 60 * 1000);
    const requestIds = await getPendingDeliveryReadyEmailRequestIds({
        readyBefore,
        limit: MAX_REQUESTS_PER_RUN,
    });
    const result = await sendBatchedDeliveryReadyEmails(requestIds);

    for (const group of result.groupsSent) {
        await markDeliveryReadyEmailsProcessed({
            requestIds: group.requestIds,
            recipients: group.recipients,
            batchRequestIds: group.requestIds,
        });
    }

    await markDeliveryReadyEmailsProcessed({
        requestIds: result.skippedRequestIds,
        recipients: [],
        skipped: true,
    });

    return Response.json({
        success: true,
        candidates: requestIds.length,
        emailsSent: result.emailsSent,
        groupsSent: result.groupsSent.length,
        requestsMarkedProcessed:
            result.skippedRequestIds.length +
            result.groupsSent.reduce(
                (total, group) => total + group.requestIds.length,
                0,
            ),
        requestsMarkedSent: result.groupsSent.reduce(
            (total, group) => total + group.requestIds.length,
            0,
        ),
        skipped: result.skippedRequestIds.length,
    });
}
