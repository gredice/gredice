import type { DeliveryPickupManifestSummary } from './deliveryDashboardTypes';
import {
    type DriverCommandResult,
    isDriverCommandResult,
} from './driverCommandResult';

export async function resolveRemainingPickupManifest(
    pickupNodeId: string,
    manifest: DeliveryPickupManifestSummary,
    onPickupItemState: (
        pickupNodeId: string,
        manifestId: string,
        stopId: number,
        outcome: 'ready' | 'missing-label' | 'not-ready',
    ) => unknown | Promise<unknown>,
): Promise<DriverCommandResult> {
    for (const item of manifest.items) {
        if (item.state !== 'ready') continue;
        const result = await onPickupItemState(
            pickupNodeId,
            manifest.id,
            item.stopId,
            'missing-label',
        );
        if (isDriverCommandResult(result) && result.status === 'failed') {
            return result;
        }
    }
    return { status: 'saved' };
}
