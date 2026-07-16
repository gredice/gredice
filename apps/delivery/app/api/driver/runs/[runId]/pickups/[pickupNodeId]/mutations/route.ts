import { DeliveryRunExecutionError } from '@gredice/storage';
import { withAuth } from '../../../../../../../../lib/auth/auth';
import { applyDriverDeliveryRunPickupMutations } from '../../../../../../../../lib/deliveryDashboard';
import { parseDeliveryPickupMutationRequest } from '../../../../../../../../lib/deliveryPickupMutationRequest';

const privateNoStoreHeaders = {
    'Cache-Control': 'private, no-store',
};

function executionErrorMessage(code: string) {
    switch (code) {
        case 'pickup-not-current':
        case 'route-order':
            return 'Ovo preuzimanje još nije na redu rute.';
        case 'pickup-dependency-pending':
            return 'Najprije dovrši trenutačno preuzimanje uroda.';
        case 'pickup-manifest-incomplete':
            return 'Manifest još sadrži urode koji nisu potvrđeni.';
        case 'pickup-operation-conflict':
            return 'Ova je promjena već poslana s drugim podacima. Osvježi manifest.';
        case 'pickup-trace-invalid':
        case 'pickup-item-not-found':
        case 'pickup-item-state-invalid':
        case 'pickup-manifest-not-found':
            return 'Manifest se promijenio. Osvježi podatke i provjeri označene urode.';
        case 'active-run-not-found':
            return 'Aktivna ruta više nije dostupna.';
        default:
            return 'Promjenu preuzimanja nije moguće primijeniti.';
    }
}

export async function POST(
    request: Request,
    {
        params,
    }: {
        params: Promise<{ runId: string; pickupNodeId: string }>;
    },
) {
    return await withAuth(['driver', 'admin'], async ({ userId }) => {
        const { runId, pickupNodeId } = await params;
        if (
            !runId ||
            runId.length > 256 ||
            !pickupNodeId ||
            pickupNodeId.length > 256
        ) {
            return Response.json(
                { error: 'Neispravno preuzimanje.' },
                { status: 400, headers: privateNoStoreHeaders },
            );
        }
        const body: unknown = await request.json().catch(() => null);
        const mutations = parseDeliveryPickupMutationRequest(body);
        if (!mutations) {
            return Response.json(
                { error: 'Promjene manifesta nisu valjane.' },
                { status: 400, headers: privateNoStoreHeaders },
            );
        }

        try {
            const results = await applyDriverDeliveryRunPickupMutations({
                driverUserId: userId,
                runId,
                pickupNodeId,
                mutations,
            });
            return Response.json(
                { results },
                { headers: privateNoStoreHeaders },
            );
        } catch (error) {
            const code =
                error instanceof DeliveryRunExecutionError
                    ? error.code
                    : 'pickup-mutation-failed';
            if (error instanceof DeliveryRunExecutionError) {
                console.warn('Delivery pickup mutation rejected', {
                    code,
                    runId,
                    pickupNodeId,
                    mutationCount: mutations.length,
                    userId,
                });
                return Response.json(
                    { error: executionErrorMessage(code), code },
                    { status: 409, headers: privateNoStoreHeaders },
                );
            }
            console.error('Delivery pickup mutation failed', {
                error,
                runId,
                pickupNodeId,
                mutationCount: mutations.length,
                userId,
            });
            return Response.json(
                {
                    error: 'Manifest trenutačno nije moguće sinkronizirati.',
                    code,
                },
                { status: 503, headers: privateNoStoreHeaders },
            );
        }
    });
}
