import {
    type DeliveryLifecycleNotificationHealth,
    getDeliveryLifecycleNotificationHealth,
} from '@gredice/storage';

const healthWindowMinutes = 15;
const staleAgeMinutes = 10;

type DeliveryNotificationHealthDependencies = {
    getHealth: typeof getDeliveryLifecycleNotificationHealth;
};

export type DeliveryNotificationHealthResult =
    | {
          enabled: false;
          severity: 'disabled';
      }
    | ({ enabled: true } & DeliveryLifecycleNotificationHealth);

const defaultDependencies: DeliveryNotificationHealthDependencies = {
    getHealth: getDeliveryLifecycleNotificationHealth,
};

export function readDeliveryNotificationHealthEnabled(
    value = process.env.GREDICE_DELIVERY_NOTIFICATION_HEALTH_ENABLED,
) {
    const normalized = value?.trim().toLowerCase();
    return normalized
        ? ['1', 'true', 'yes', 'on', 'enabled'].includes(normalized)
        : false;
}

function failureContext(health: DeliveryLifecycleNotificationHealth) {
    return {
        channels: health.channels.map((channel) => ({
            channel: channel.channel,
            failureCount: channel.failureCount,
            failureRate: channel.failureRate,
            terminalCount: channel.terminalCount,
        })),
        windowMinutes: healthWindowMinutes,
    };
}

export async function runDeliveryNotificationHealth({
    dependencies: dependencyOverrides = {},
    enabled = readDeliveryNotificationHealthEnabled(),
    now = new Date(),
}: {
    dependencies?: Partial<DeliveryNotificationHealthDependencies>;
    enabled?: boolean;
    now?: Date;
} = {}): Promise<DeliveryNotificationHealthResult> {
    if (!enabled) return { enabled: false, severity: 'disabled' };
    const dependencies = { ...defaultDependencies, ...dependencyOverrides };
    const health = await dependencies.getHealth({ now });

    if (health.severity === 'critical') {
        console.error(
            'Delivery notification systemic channel failure',
            failureContext(health),
        );
    } else if (health.severity === 'warning') {
        console.warn(
            'Delivery notification channel failure warning',
            failureContext(health),
        );
    }
    if (health.retryExhaustedCount > 0) {
        console.error('Delivery notification retries exhausted', {
            count: health.retryExhaustedCount,
            windowMinutes: healthWindowMinutes,
        });
    }
    if (health.staleEligibleQueueCount >= 5) {
        console.warn('Delivery notification eligible queue is stale', {
            ageMinutes: staleAgeMinutes,
            count: health.staleEligibleQueueCount,
        });
    }
    if (health.ambiguousEmailSendingCount > 0) {
        console.error('Delivery notification email acceptance is ambiguous', {
            ageMinutes: staleAgeMinutes,
            count: health.ambiguousEmailSendingCount,
        });
    }

    return { enabled: true, ...health };
}

const noStoreHeaders = { 'Cache-Control': 'private, no-store' };

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

export async function handleDeliveryNotificationHealthCron(
    request: Request,
    dependencies: { run: () => Promise<DeliveryNotificationHealthResult> } = {
        run: runDeliveryNotificationHealth,
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
            { success: result.severity !== 'critical', ...result },
            {
                headers: noStoreHeaders,
                status: result.severity === 'critical' ? 503 : 200,
            },
        );
    } catch (error) {
        console.error('Delivery notification health cron failed', {
            ...boundedErrorContext(error),
        });
        return Response.json(
            { success: false },
            { headers: noStoreHeaders, status: 500 },
        );
    }
}
