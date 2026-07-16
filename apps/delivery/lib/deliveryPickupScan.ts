import type { DeliveryPickupStepSummary } from './deliveryDashboardTypes';
import { isDriverCommandResult } from './driverCommandResult';
import { normalizeHarvestTraceScanValue } from './harvestTraceScan';

export type PickupManifestScanResult =
    | { status: 'pickup-invalid' }
    | { status: 'pickup-not-at-location'; tracePath: string }
    | { status: 'pickup-ambiguous'; tracePath: string }
    | {
          status: 'pickup-already-collected';
          tracePath: string;
          plantName: string;
      }
    | {
          status: 'pickup-not-ready';
          tracePath: string;
          plantName: string;
      }
    | {
          status: 'pickup-queued';
          tracePath: string;
          plantName: string;
          matchedCount: number;
      }
    | {
          status: 'pickup-failed';
          tracePath: string;
          plantName: string;
          message: string;
      };

export async function scanPickupManifest(
    pickup: DeliveryPickupStepSummary,
    scanValue: string,
    onPickupScan: (
        pickupNodeId: string,
        scanValue: string,
    ) => unknown | Promise<unknown>,
): Promise<PickupManifestScanResult> {
    const tracePath = normalizeHarvestTraceScanValue(scanValue);
    if (!tracePath) return { status: 'pickup-invalid' };

    const matchingItems = pickup.manifests.flatMap((manifest) =>
        manifest.items.filter((item) => item.tracePath === tracePath),
    );
    if (matchingItems.length === 0) {
        return { status: 'pickup-not-at-location', tracePath };
    }
    if (new Set(matchingItems.map((item) => item.stopKey)).size > 1) {
        return { status: 'pickup-ambiguous', tracePath };
    }
    const pendingItems = matchingItems.filter(
        (item) => item.state === 'ready' || item.state === 'not-ready',
    );
    const firstItem = matchingItems[0];
    if (!firstItem) return { status: 'pickup-not-at-location', tracePath };
    if (
        pendingItems.length > 0 &&
        pendingItems.every((item) => item.state === 'not-ready')
    ) {
        return {
            status: 'pickup-not-ready',
            tracePath,
            plantName: firstItem.harvest.plantName,
        };
    }
    if (pendingItems.length === 0) {
        return {
            status: 'pickup-already-collected',
            tracePath,
            plantName: firstItem.harvest.plantName,
        };
    }

    const enqueueResult = await onPickupScan(pickup.id, tracePath);
    if (
        isDriverCommandResult(enqueueResult) &&
        enqueueResult.status === 'failed'
    ) {
        return {
            status: 'pickup-failed',
            tracePath,
            plantName: firstItem.harvest.plantName,
            message: enqueueResult.message,
        };
    }
    return {
        status: 'pickup-queued',
        tracePath,
        plantName: firstItem.harvest.plantName,
        matchedCount: pendingItems.length,
    };
}
