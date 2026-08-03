import { getStripeCheckoutSessions } from '@gredice/stripe/server';
import { processCheckoutSession } from './processCheckoutSession';
import {
    getStripeCheckoutProcessingMaintenanceResponse,
    isStripeCheckoutProcessingMaintenanceEnabled,
} from './stripeCheckoutProcessingMaintenance';
import { getStripeOperationalErrorDiagnostic } from './stripeOperationalError';

type LegacyStripeReconciliationDependencies = {
    getSessions: (from: Date) => Promise<readonly { id: string }[]>;
    maintenanceEnabled: () => boolean;
    now: () => Date;
    process: (checkoutSessionId?: string) => Promise<unknown>;
};

const defaultDependencies: LegacyStripeReconciliationDependencies = {
    getSessions: getStripeCheckoutSessions,
    maintenanceEnabled: isStripeCheckoutProcessingMaintenanceEnabled,
    now: () => new Date(),
    process: processCheckoutSession,
};

export async function handleLegacyStripeReconciliationCron(
    request: Request,
    dependencies: Partial<LegacyStripeReconciliationDependencies> = {},
) {
    const cronSecret = process.env.CRON_SECRET?.trim();
    const authHeader = request.headers.get('authorization');
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        return new Response('Unauthorized', {
            headers: { 'Cache-Control': 'private, no-store' },
            status: 401,
        });
    }

    const resolved = { ...defaultDependencies, ...dependencies };
    if (resolved.maintenanceEnabled()) {
        return getStripeCheckoutProcessingMaintenanceResponse('cron');
    }

    try {
        const from = resolved.now();
        from.setDate(from.getDate() - 3);
        const checkoutSessions = await resolved.getSessions(from);
        await Promise.all(
            checkoutSessions.map((session) => resolved.process(session.id)),
        );
        return Response.json(
            {
                success: true,
                processedCheckoutSessions: checkoutSessions.length,
            },
            { headers: { 'Cache-Control': 'private, no-store' } },
        );
    } catch (error) {
        console.error('Legacy Stripe reconciliation failed', {
            ...getStripeOperationalErrorDiagnostic(error),
        });
        return new Response('Stripe reconciliation failed', {
            headers: {
                'Cache-Control': 'private, no-store',
                'Retry-After': '60',
            },
            status: 503,
        });
    }
}
