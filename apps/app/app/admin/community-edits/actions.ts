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
import { notifyCommunityEditSubmitter } from './notifyCommunityEditSubmitter';

function reviewerFromAuth(authContext: Awaited<ReturnType<typeof auth>>) {
    return {
        id: authContext.userId,
        name: authContext.user.userName,
    } satisfies CommunityEditActor;
}

function formText(formData: FormData, name: string) {
    const value = formData.get(name);
    if (typeof value !== 'string') {
        return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

/** Internal note; never shown to the submitter. */
function formNote(formData: FormData) {
    return formText(formData, 'reviewerNote');
}

/** The moderator's reply, shown to the submitter. */
function formSubmitterMessage(formData: FormData) {
    return formText(formData, 'submitterMessage');
}

async function revalidateCommunityEditAdminPaths(requestId: number) {
    revalidatePath(KnownPages.Dashboard, 'layout');
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
        submitterMessage: formSubmitterMessage(formData),
    });

    await revalidateCommunityEditAdminPaths(requestId);
    await revalidateAppliedRequest(requestId);
    // Approval ends applied, or conflicted when the content moved on.
    await notifyCommunityEditSubmitter(requestId);
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
        submitterMessage: formSubmitterMessage(formData),
    });

    await revalidateCommunityEditAdminPaths(requestId);
    await notifyCommunityEditSubmitter(requestId);
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
        submitterMessage: formSubmitterMessage(formData),
    });

    await revalidateCommunityEditAdminPaths(requestId);
    await notifyCommunityEditSubmitter(requestId);
}
