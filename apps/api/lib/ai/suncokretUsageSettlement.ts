import {
    calculateAiChatUsageCostMicroEur,
    finalizeAiChatUsage,
} from '@gredice/storage';
import { waitUntil } from '@vercel/functions';
import { getSuncokretGatewayBilledCostMicroEur } from './suncokretModels';

type UsageFinalization = Parameters<typeof finalizeAiChatUsage>[0];

export function scheduleSuncokretUsageSettlement({
    context,
    steps,
    usage,
    loadBilledCost = getSuncokretGatewayBilledCostMicroEur,
    finalize = finalizeAiChatUsage,
    schedule = waitUntil,
}: {
    context: {
        accountId: string;
        conversationId: string;
        modelId: string;
        requestId: string;
    };
    steps: Parameters<typeof getSuncokretGatewayBilledCostMicroEur>[0];
    usage: Omit<UsageFinalization, 'billedTotalMicroEur'>;
    loadBilledCost?: typeof getSuncokretGatewayBilledCostMicroEur;
    finalize?: typeof finalizeAiChatUsage;
    schedule?: (task: Promise<unknown>) => void;
}) {
    // Do not await Gateway polling in streamText.onFinish. Keep the existing
    // reservation counted in both quotas until this single settlement completes.
    const settlement = async () => {
        let billedTotalMicroEur: number | null = null;
        try {
            billedTotalMicroEur = await loadBilledCost(steps);
            if (billedTotalMicroEur === null) {
                console.warn(
                    'Suncokret AI Gateway billed cost is unavailable; using token estimate',
                    context,
                );
            }
        } catch (error) {
            console.warn(
                'Suncokret AI Gateway billed cost lookup failed; using token estimate',
                { ...context, error },
            );
        }

        try {
            await finalize({
                ...usage,
                ...(billedTotalMicroEur === null
                    ? {}
                    : { billedTotalMicroEur }),
            });
        } catch (error) {
            // A persistence failure must not release the quota reservation.
            console.error('Suncokret usage settlement failed', {
                ...context,
                ledgerId: usage.ledgerId,
                error,
            });
        }
    };
    schedule(settlement());

    // Debug finish metadata is an estimate; the ledger gets the billed total
    // after the lookup. No historical ledger entries are scanned or rewritten.
    return calculateAiChatUsageCostMicroEur(usage);
}
