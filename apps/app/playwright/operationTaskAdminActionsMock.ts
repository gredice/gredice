export async function updateOperationTaskAdminAction(...args: unknown[]) {
    document.documentElement.dataset.savedAdminTask = JSON.stringify(args);
    if (document.documentElement.dataset.adminTaskConflict === 'true') {
        return {
            success: false,
            conflict: true,
            message: 'Radnja se u međuvremenu promijenila.',
        };
    }
    if (document.documentElement.dataset.adminTaskFailure === 'true') {
        return {
            success: false,
            message: 'Spremanje nije uspjelo. Pokušaj ponovno.',
        };
    }
    return { success: true };
}
