export async function updateOperationCompletionEvidenceAction(
    ...args: unknown[]
) {
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
