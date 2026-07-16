import { parseDeliveryHandoffMutationRequest } from './deliveryHandoffMutationRequest';

const privateNoStoreHeaders = {
    'Cache-Control': 'private, no-store',
};

const authenticatedRoles = ['driver', 'admin'];

type DeliveryHandoffAuthContext = {
    userId: string;
    user: {
        role: string;
    };
};

type DeliveryHandoffRouteContext = {
    params: Promise<{ runId: string; stopId: string }>;
};

type ParsedDeliveryHandoffRequest = NonNullable<
    ReturnType<typeof parseDeliveryHandoffMutationRequest>
>;

type DeliveryHandoffRouteDependencies = {
    withAuth: (
        roles: string[],
        handler: (context: DeliveryHandoffAuthContext) => Promise<Response>,
    ) => Promise<Response>;
    getManifest: (input: {
        readerUserId: string;
        runId: string;
        targetStopId: number;
        allowAnyRun: boolean;
    }) => Promise<unknown>;
    applyMutations: (input: {
        driverUserId: string;
        runId: string;
        targetStopId: number;
        expectedRetryAttempt: number;
        mutations: ParsedDeliveryHandoffRequest['mutations'];
    }) => Promise<unknown>;
    executionErrorCode: (error: unknown) => string | null;
    logger?: Pick<Console, 'error' | 'warn'>;
};

function executionErrorMessage(code: string) {
    switch (code) {
        case 'handoff-operation-conflict':
            return 'Ova je provjera već poslana s drugim podacima. Osvježi popis uroda.';
        case 'handoff-operation-invalid':
            return 'Podaci provjere nisu valjani. Osvježi popis uroda i pokušaj ponovno.';
        case 'active-run-not-found':
            return 'Aktivna ruta više nije dostupna.';
        case 'route-order':
            return 'Ova dostava još nije na redu rute.';
        case 'pickup-dependency-pending':
            return 'Najprije potvrdi preuzimanje svih uroda na trenutačnoj lokaciji.';
        case 'route-revision-conflict':
            return 'Ruta se promijenila. Osvježi popis uroda i pokušaj ponovno.';
        default:
            return 'Provjeru predaje nije moguće primijeniti na trenutačnu rutu.';
    }
}

async function routeTarget(params: DeliveryHandoffRouteContext['params']) {
    const { runId, stopId: stopIdValue } = await params;
    const stopId = Number(stopIdValue);
    return {
        runId,
        stopId,
        valid:
            runId.length > 0 &&
            runId.length <= 256 &&
            Number.isSafeInteger(stopId) &&
            stopId > 0 &&
            stopId <= 2_147_483_647,
    };
}

function invalidTargetResponse() {
    return Response.json(
        { error: 'Neispravna stanica predaje.' },
        { status: 400, headers: privateNoStoreHeaders },
    );
}

function executionErrorResponse(code: string | null, fallbackCode: string) {
    if (code) {
        return Response.json(
            { error: executionErrorMessage(code), code },
            { status: 409, headers: privateNoStoreHeaders },
        );
    }
    return Response.json(
        {
            error: 'Provjeru predaje trenutačno nije moguće sinkronizirati.',
            code: fallbackCode,
        },
        { status: 503, headers: privateNoStoreHeaders },
    );
}

function addPrivateNoStoreHeader(response: Response) {
    response.headers.set(
        'Cache-Control',
        privateNoStoreHeaders['Cache-Control'],
    );
    return response;
}

export function createDeliveryHandoffRouteHandlers({
    withAuth,
    getManifest,
    applyMutations,
    executionErrorCode,
    logger = console,
}: DeliveryHandoffRouteDependencies) {
    async function authorize(
        handler: (context: DeliveryHandoffAuthContext) => Promise<Response>,
    ) {
        return addPrivateNoStoreHeader(
            await withAuth(authenticatedRoles, handler),
        );
    }

    async function GET(
        _request: Request,
        { params }: DeliveryHandoffRouteContext,
    ) {
        return await authorize(async ({ userId, user }) => {
            const { runId, stopId, valid } = await routeTarget(params);
            if (!valid) return invalidTargetResponse();

            try {
                const manifest = await getManifest({
                    readerUserId: userId,
                    runId,
                    targetStopId: stopId,
                    allowAnyRun: user.role === 'admin',
                });
                return Response.json(manifest, {
                    headers: privateNoStoreHeaders,
                });
            } catch (error) {
                const code = executionErrorCode(error);
                if (code) {
                    logger.warn('Delivery handoff manifest rejected', {
                        code,
                        runId,
                        stopId,
                        userId,
                    });
                } else {
                    logger.error('Delivery handoff manifest failed', {
                        errorType:
                            error instanceof Error ? error.name : typeof error,
                        runId,
                        stopId,
                        userId,
                    });
                }
                return executionErrorResponse(code, 'handoff-manifest-failed');
            }
        });
    }

    async function POST(
        request: Request,
        { params }: DeliveryHandoffRouteContext,
    ) {
        return await authorize(async ({ userId }) => {
            const { runId, stopId, valid } = await routeTarget(params);
            if (!valid) return invalidTargetResponse();

            const body: unknown = await request.json().catch(() => null);
            const parsedRequest = parseDeliveryHandoffMutationRequest(body);
            if (!parsedRequest) {
                return Response.json(
                    { error: 'Promjene provjere predaje nisu valjane.' },
                    { status: 400, headers: privateNoStoreHeaders },
                );
            }
            const { expectedRetryAttempt, mutations } = parsedRequest;

            try {
                const results = await applyMutations({
                    driverUserId: userId,
                    runId,
                    targetStopId: stopId,
                    expectedRetryAttempt,
                    mutations,
                });
                return Response.json(
                    { results },
                    { headers: privateNoStoreHeaders },
                );
            } catch (error) {
                const code = executionErrorCode(error);
                if (code) {
                    logger.warn('Delivery handoff mutation rejected', {
                        code,
                        runId,
                        stopId,
                        mutationCount: mutations.length,
                        userId,
                    });
                } else {
                    logger.error('Delivery handoff mutation failed', {
                        errorType:
                            error instanceof Error ? error.name : typeof error,
                        runId,
                        stopId,
                        mutationCount: mutations.length,
                        userId,
                    });
                }
                return executionErrorResponse(code, 'handoff-mutation-failed');
            }
        });
    }

    return { GET, POST };
}
