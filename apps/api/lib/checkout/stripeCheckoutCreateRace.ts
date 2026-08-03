import { StripeCheckoutAttemptConflictError } from '@gredice/storage';

export type StripeCheckoutCreateRaceRecovery<TRecovery> =
    | { status: 'cart_changed' }
    | { status: 'no_active_attempt' }
    | { recovery: TRecovery; status: 'recovered' };

export async function recoverStripeCheckoutAttemptAfterCreateRace<
    TAttempt,
    TRecovery,
>({
    getActiveAttempt,
    recoverAttempt,
}: {
    getActiveAttempt: () => Promise<TAttempt | undefined>;
    recoverAttempt: (attempt: TAttempt) => Promise<TRecovery>;
}): Promise<StripeCheckoutCreateRaceRecovery<TRecovery>> {
    const activeAttempt = await getActiveAttempt();
    if (!activeAttempt) {
        return { status: 'no_active_attempt' };
    }

    try {
        return {
            recovery: await recoverAttempt(activeAttempt),
            status: 'recovered',
        };
    } catch (error) {
        if (error instanceof StripeCheckoutAttemptConflictError) {
            return { status: 'cart_changed' };
        }
        throw error;
    }
}
