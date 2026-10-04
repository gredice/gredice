export type CustomerDashboardFreshnessFailure = 'offline' | 'refresh' | null;

export type CustomerDashboardFreshnessState = {
    scopeKey: string | null;
    failure: CustomerDashboardFreshnessFailure;
    staleSuccessVersion: number | null;
};

export const initialCustomerDashboardFreshnessState: CustomerDashboardFreshnessState =
    {
        scopeKey: null,
        failure: null,
        staleSuccessVersion: null,
    };

function freshState(scopeKey: string): CustomerDashboardFreshnessState {
    return { scopeKey, failure: null, staleSuccessVersion: null };
}

function staleState(
    current: CustomerDashboardFreshnessState,
    failure: Exclude<CustomerDashboardFreshnessFailure, null>,
    successVersion: number,
) {
    const staleSuccessVersion = current.staleSuccessVersion ?? successVersion;
    if (
        current.failure === failure &&
        current.staleSuccessVersion === staleSuccessVersion
    ) {
        return current;
    }
    return { ...current, failure, staleSuccessVersion };
}

export function nextCustomerDashboardFreshnessState(
    current: CustomerDashboardFreshnessState,
    input: {
        scopeKey: string;
        hasCustomerDashboard: boolean;
        networkOnline: boolean;
        isRefetchError: boolean;
        isSuccess: boolean;
        successVersion: number;
    },
): CustomerDashboardFreshnessState {
    const scopedCurrent =
        current.scopeKey === input.scopeKey
            ? current
            : freshState(input.scopeKey);
    if (!input.hasCustomerDashboard) {
        return scopedCurrent.failure === null &&
            scopedCurrent.staleSuccessVersion === null
            ? scopedCurrent
            : freshState(input.scopeKey);
    }
    if (!input.networkOnline) {
        return staleState(scopedCurrent, 'offline', input.successVersion);
    }
    if (input.isRefetchError) {
        return staleState(scopedCurrent, 'refresh', input.successVersion);
    }
    if (scopedCurrent.staleSuccessVersion === null) return scopedCurrent;
    if (
        input.isSuccess &&
        input.successVersion > scopedCurrent.staleSuccessVersion
    ) {
        return freshState(input.scopeKey);
    }
    return scopedCurrent;
}

export function customerDashboardFreshnessFailureForRender(
    state: CustomerDashboardFreshnessState,
    input: {
        scopeKey: string;
        networkOnline: boolean;
        isRefetchError: boolean;
    },
): CustomerDashboardFreshnessFailure {
    if (!input.networkOnline) return 'offline';
    if (input.isRefetchError) return 'refresh';
    return state.scopeKey === input.scopeKey ? state.failure : null;
}

export function shouldShowDeliveryDashboardLoading(input: {
    isPending: boolean;
    networkOnline: boolean;
    waitForOfflineRoute: boolean;
    hasOfflineRoute: boolean;
    offlineFallbackReady: boolean;
}) {
    if (!input.isPending) return false;
    if (!input.networkOnline) {
        return (
            input.waitForOfflineRoute &&
            !input.hasOfflineRoute &&
            !input.offlineFallbackReady
        );
    }
    return !(input.hasOfflineRoute && input.offlineFallbackReady);
}
