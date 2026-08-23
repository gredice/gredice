import {
    type DeliveryLifecycleEmailWorkerResult,
    runDeliveryLifecycleEmailWorker,
} from './deliveryLifecycleEmailWorker';

const noStoreHeaders = { 'Cache-Control': 'private, no-store' };

type DeliveryLifecycleEmailCronDependencies = {
    run: () => Promise<DeliveryLifecycleEmailWorkerResult>;
};

function boundedErrorContext(error: unknown) {
    const errorName =
        error instanceof Error ? error.name.slice(0, 64) : 'Unknown';
    const errorCode =
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        typeof error.code === 'string' &&
        /^[A-Za-z0-9._:-]{1,64}$/u.test(error.code)
            ? error.code
            : undefined;
    return { errorCode, errorName };
}

export async function handleDeliveryLifecycleEmailCron(
    request: Request,
    dependencies: DeliveryLifecycleEmailCronDependencies = {
        run: runDeliveryLifecycleEmailWorker,
    },
) {
    const cronSecret = process.env.CRON_SECRET?.trim();
    if (
        !cronSecret ||
        request.headers.get('authorization') !== `Bearer ${cronSecret}`
    ) {
        return new Response('Unauthorized', {
            headers: noStoreHeaders,
            status: 401,
        });
    }

    try {
        const result = await dependencies.run();
        return Response.json(
            {
                success:
                    result.claimFailures === 0 &&
                    result.finalizationFailures === 0,
                ...result,
            },
            { headers: noStoreHeaders },
        );
    } catch (error) {
        console.error('Delivery lifecycle email cron failed', {
            ...boundedErrorContext(error),
        });
        return Response.json(
            { success: false },
            { headers: noStoreHeaders, status: 500 },
        );
    }
}
