import {
    applyDeliveryRunHandoffMutations,
    DeliveryRunExecutionError,
    getDeliveryRunHandoffManifest,
} from '@gredice/storage';
import { withAuth } from '../../../../../../../../../lib/auth/auth';
import { createDeliveryHandoffRouteHandlers } from '../../../../../../../../../lib/deliveryHandoffRoute';

const handlers = createDeliveryHandoffRouteHandlers({
    withAuth,
    getManifest: getDeliveryRunHandoffManifest,
    applyMutations: applyDeliveryRunHandoffMutations,
    executionErrorCode: (error) =>
        error instanceof DeliveryRunExecutionError ? error.code : null,
});

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ runId: string; stopId: string }> },
) {
    return await handlers.GET(_request, { params });
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ runId: string; stopId: string }> },
) {
    return await handlers.POST(request, { params });
}
