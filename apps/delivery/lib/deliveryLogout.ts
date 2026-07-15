import {
    publishDeliveryLogout,
    publishDeliveryLogoutCompleted,
    publishDeliveryLogoutFailed,
} from './deliveryOfflineEvents';
import {
    clearDeliveryUserStoredState,
    createBrowserDeliveryUserStoredState,
} from './deliveryRunStoredState';

export type DeliveryLogoutLifecycle = {
    clearLocalState: () => Promise<void>;
    requestServerLogout: () => Promise<{ ok: boolean }>;
    publishStarted: () => string;
    publishCompleted: (logoutId: string) => void;
    publishFailed: (logoutId: string) => void;
};

export async function executeDeliveryLogout(
    lifecycle: DeliveryLogoutLifecycle,
) {
    const logoutId = lifecycle.publishStarted();
    try {
        await lifecycle.clearLocalState();
        const response = await lifecycle.requestServerLogout();
        if (!response.ok) throw new Error('Logout failed');
        await lifecycle.clearLocalState();
        lifecycle.publishCompleted(logoutId);
        return true;
    } catch {
        try {
            await lifecycle.clearLocalState();
        } catch {
            // The logout guard remains active so a later retry can finish.
        }
        lifecycle.publishFailed(logoutId);
        return false;
    }
}

export async function performDeliveryLogout(userId: string) {
    return await executeDeliveryLogout({
        clearLocalState: async () =>
            await clearDeliveryUserStoredState(
                createBrowserDeliveryUserStoredState(),
                { userId },
            ),
        requestServerLogout: async () =>
            await fetch('/api/logout', { method: 'POST' }),
        publishStarted: publishDeliveryLogout,
        publishCompleted: publishDeliveryLogoutCompleted,
        publishFailed: publishDeliveryLogoutFailed,
    });
}
