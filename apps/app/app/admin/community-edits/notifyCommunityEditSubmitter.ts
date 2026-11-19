import 'server-only';
import {
    createNotification,
    getCommunityEditRequest,
    getEntityDisplayLabels,
    getUser,
    parseCommunityEntitySuggestionRequest,
} from '@gredice/storage';
import { communityEditSubmitterNotificationCopy } from './communityEditNotificationCopy';

/** WWW page where a submitter follows their suggestions. */
const mySuggestionsUrl = 'https://www.gredice.com/moji-prijedlozi';

/**
 * Tells the submitter how their request was decided. Safe to call after every
 * review action: only applied, rejected and conflicted requests notify, the
 * idempotency key makes repeats a no-op, and a failure here never fails the
 * review that already happened.
 */
export async function notifyCommunityEditSubmitter(requestId: number) {
    try {
        const request = await getCommunityEditRequest(requestId);
        if (!request) {
            return;
        }

        const suggestion = parseCommunityEntitySuggestionRequest(request);
        const title =
            suggestion?.name ??
            (await getEntityDisplayLabels([request.entityId]))[0]?.label;
        if (!title) {
            return;
        }

        const copy = communityEditSubmitterNotificationCopy({
            kind: suggestion ? 'suggestion' : 'edit',
            status: request.status,
            submitterMessage: request.submitterMessage,
            title,
        });
        if (!copy) {
            return;
        }

        const submitter = await getUser(request.submitterUserId);
        const accountId = submitter?.accounts[0]?.accountId;
        if (!accountId) {
            return;
        }

        await createNotification(
            {
                accountId,
                userId: request.submitterUserId,
                ...copy,
                linkUrl: mySuggestionsUrl,
                timestamp: request.reviewedAt ?? new Date(),
            },
            {
                idempotencyKey: `community-edit:${request.status}:${request.id}`,
            },
        );
    } catch (error) {
        console.error('Failed to notify community edit submitter', {
            requestId,
            error,
        });
    }
}
