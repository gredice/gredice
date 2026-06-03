'use server';

import {
    approveCommunityEditRequest,
    type CommunityEditActor,
    getCommunityEditRequest,
    markCommunityEditRequestConflicted,
    rejectCommunityEditRequest,
} from '@gredice/storage';
import { revalidatePath } from 'next/cache';
import { auth } from '../../../lib/auth/auth';
import { revalidatePublicDirectoryPagesForEntityType } from '../../../lib/revalidation/publicDirectoryPages';
import { KnownPages } from '../../../src/KnownPages';

function reviewerFromAuth(authContext: Awaited<ReturnType<typeof auth>>) {
    return {
        id: authContext.userId,
        name: authContext.user.userName,
    } satisfies CommunityEditActor;
}

function formNote(formData: FormData) {
    const value = formData.get('reviewerNote');
    if (typeof value !== 'string') {
        return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

async function revalidateCommunityEditAdminPaths(requestId: number) {
    revalidatePath(KnownPages.CommunityEdits);
    revalidatePath(KnownPages.CommunityEdit(requestId));
}

async function revalidateAppliedRequest(requestId: number) {
    const request = await getCommunityEditRequest(requestId);
    if (request?.status !== 'applied') {
        return;
    }

    revalidatePath(
        KnownPages.DirectoryEntity(request.entityTypeName, request.entityId),
    );
    await revalidatePublicDirectoryPagesForEntityType(
        request.entityTypeName,
        'community-edit.approve',
    );
}

export async function approveCommunityEditRequestAction(
    requestId: number,
    formData: FormData,
) {
    const authContext = await auth(['admin']);
    await approveCommunityEditRequest({
        id: requestId,
        reviewer: reviewerFromAuth(authContext),
        reviewerNote: formNote(formData),
    });

    await revalidateCommunityEditAdminPaths(requestId);
    await revalidateAppliedRequest(requestId);
}

export async function rejectCommunityEditRequestAction(
    requestId: number,
    formData: FormData,
) {
    const authContext = await auth(['admin']);
    await rejectCommunityEditRequest({
        id: requestId,
        reviewer: reviewerFromAuth(authContext),
        reviewerNote: formNote(formData),
    });

    await revalidateCommunityEditAdminPaths(requestId);
}

export async function markCommunityEditRequestConflictedAction(
    requestId: number,
    formData: FormData,
) {
    const authContext = await auth(['admin']);
    await markCommunityEditRequestConflicted({
        id: requestId,
        reviewer: reviewerFromAuth(authContext),
        reason:
            formNote(formData) ?? 'Reviewer marked this request as conflicted.',
    });

    await revalidateCommunityEditAdminPaths(requestId);
}
