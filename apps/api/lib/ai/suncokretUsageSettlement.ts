import {
    calculateAiChatUsageCostMicroEur,
    finalizeAiChatUsage,
} from '@gredice/storage';
import { getDeadline, waitUntil } from '@vercel/functions';
import {
    getSuncokretGatewayBilledCostMicroEur,
    SUNCOKRET_GATEWAY_COST_LOOKUP_TIMEOUT_MS,
    suncokretGatewayGenerationIds,
} from './suncokretModels';

type UsageFinalization = Parameters<typeof finalizeAiChatUsage>[0];

export function scheduleSuncokretUsageSettlement({
    context,
    steps,
    usage,
    invocationDeadline = getDeadline(),
    now = Date.now,
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
    invocationDeadline?: Date;
    now?: () => number;
    loadBilledCost?: typeof getSuncokretGatewayBilledCostMicroEur;
    finalize?: typeof finalizeAiChatUsage;
    schedule?: (task: Promise<unknown>) => void;
}) {
    // Do not await Gateway polling in streamText.onFinish. Keep the existing
    // reservation counted in both quotas until this single settlement completes.
    const settlement = async () => {
        const lookupContext = {
            ...context,
            ledgerId: usage.ledgerId,
            generationIds: suncokretGatewayGenerationIds(steps),
        };
        let billedTotalMicroEur: number | null = null;
        try {
            // waitUntil shares the invocation's deadline. Leave five seconds
            // for ledger persistence, including when generation finishes late.
            const lookupTimeoutMs = Math.max(
                0,
                Math.min(
                    SUNCOKRET_GATEWAY_COST_LOOKUP_TIMEOUT_MS,
                    (invocationDeadline?.getTime() ?? Infinity) - now() - 5_000,
                ),
            );
            if (lookupTimeoutMs > 0) {
                billedTotalMicroEur = await loadBilledCost(
                    steps,
                    undefined,
                    undefined,
                    lookupTimeoutMs,
                );
            }
            if (billedTotalMicroEur === null) {
                console.warn(
                    'Suncokret AI Gateway billed cost is unavailable; using token estimate',
                    lookupContext,
                );
            }
        } catch (error) {
            console.warn(
                'Suncokret AI Gateway billed cost lookup failed; using token estimate',
                { ...lookupContext, error },
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
