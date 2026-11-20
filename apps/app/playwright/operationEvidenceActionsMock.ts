export async function updateOperationCompletionEvidenceAction(
    ...args: unknown[]
) {
    if (document.documentElement.dataset.evidenceSaveFailsOnce === 'true') {
        delete document.documentElement.dataset.evidenceSaveFailsOnce;
        throw new Error('Temporary save failure');
    }
    document.documentElement.dataset.savedEvidence = JSON.stringify(args);
    if (document.documentElement.dataset.evidenceConflict === 'true') {
        return {
            success: false,
            message:
                'Radnja se u međuvremenu promijenila. Osvježi stranicu i pokušaj ponovno.',
        };
    }
    return { success: true };
}

export async function completeOperationWithImageUrls(...args: unknown[]) {
    document.documentElement.dataset.completedPhotoOperation =
        JSON.stringify(args);
}

export const completeOperation = completeOperationWithImageUrls;
