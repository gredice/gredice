import { getDeliveryRun, isDeliveryRunStopTerminal } from '@gredice/storage';
import { withAuth } from '../../../../lib/auth/auth';
import {
    customerDeliveryTrackingContext,
    type DeliveryRun,
    type ResolvedDeliveryRunStopGroup,
    resolveDeliveryRunStopGroups,
} from '../../../../lib/deliveryDashboard';
import { createDeliveryMapRouteHandlers } from '../../../../lib/deliveryMapRoute';
import { driverDeliveryTrackingLocation } from '../../../../lib/deliveryTracking';
import {
    buildGoogleStaticMapUrl,
    unavailableMapSvg,
} from '../../../../lib/googleStaticMap';

const handlers = createDeliveryMapRouteHandlers<
    DeliveryRun,
    ResolvedDeliveryRunStopGroup
>({
    withAuth,
    getRun: getDeliveryRun,
    getCustomerTrackingContext: customerDeliveryTrackingContext,
    resolveGroups: resolveDeliveryRunStopGroups,
    getDriverLocation: driverDeliveryTrackingLocation,
    isStopTerminal: isDeliveryRunStopTerminal,
    buildStaticMapUrl: buildGoogleStaticMapUrl,
    unavailableMapSvg,
});

export async function GET(
    request: Request,
    { params }: { params: Promise<{ runId: string }> },
) {
    return await handlers.GET(request, { params });
}
