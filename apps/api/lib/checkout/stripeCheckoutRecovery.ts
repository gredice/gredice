import {
    type StripeCheckoutAttempt,
    StripeCheckoutAttemptConflictError,
} from '@gredice/storage';
import type { stripeCheckout, UserAccount } from '@gredice/stripe/server';
import { buildStripeCheckoutReplayInput } from './stripeCheckoutSnapshot';

type RecoveryDependencies = {
    bindAttempt: (input: {
        attemptId: string;
        cartId: number;
        sessionId: string;
    }) => Promise<unknown>;
    checkout: typeof stripeCheckout;
    getAttempt: (
        cartId: number,
        attemptId: string,
    ) => Promise<StripeCheckoutAttempt | undefined>;
    getSession: (sessionId: string) => Promise<
        | {
              id: string;
              customerId: string | { id: string } | null;
              status: 'complete' | 'expired' | 'open' | null;
              url: string | null;
          }
        | undefined
    >;
    releaseAttempt: (input: {
        attemptId: string;
        cartId: number;
        reason: 'expired';
        sessionId: string | null;
    }) => Promise<unknown>;
};

export type StripeCheckoutRecoveryResult =
    | { status: 'open'; sessionId: string; url: string | null }
    | { status: 'processing' }
    | { status: 'released' };

export async function recoverStripeCheckoutAttemptSession({
    account,
    accountId,
    attempt,
    checkoutAdditionalDataByCartItemId,
    customerId,
    dependencies,
    now = new Date(),
    userId,
}: {
    account: UserAccount;
    accountId: string;
    attempt: StripeCheckoutAttempt;
    checkoutAdditionalDataByCartItemId?: ReadonlyMap<number, unknown>;
    customerId: string;
    dependencies: RecoveryDependencies;
    now?: Date;
    userId: string;
}): Promise<StripeCheckoutRecoveryResult> {
    if (attempt.releaseReason) {
        return { status: 'released' };
    }
    if (attempt.sessionId) {
        const session = await dependencies.getSession(attempt.sessionId);
        const sessionCustomerId =
            typeof session?.customerId === 'string'
                ? session.customerId
                : session?.customerId?.id;
        if (session && sessionCustomerId !== customerId) {
            throw new StripeCheckoutAttemptConflictError(
                'stripe_customer_changed',
            );
        }
        if (session?.status === 'open') {
            return {
                status: 'open',
                sessionId: session.id,
                url: session.url,
            };
        }
        if (session?.status === 'expired') {
            await dependencies.releaseAttempt({
                attemptId: attempt.snapshot.attemptId,
                cartId: attempt.snapshot.cartId,
                reason: 'expired',
                sessionId: attempt.sessionId,
            });
            return { status: 'released' };
        }
        return { status: 'processing' };
    }

    const expiresAt = attempt.snapshot.stripeSession.expiresAt;
    if (expiresAt && new Date(expiresAt).getTime() <= now.getTime()) {
        await dependencies.releaseAttempt({
            attemptId: attempt.snapshot.attemptId,
            cartId: attempt.snapshot.cartId,
            reason: 'expired',
            sessionId: null,
        });
        return { status: 'released' };
    }
    if (!checkoutAdditionalDataByCartItemId) {
        throw new StripeCheckoutAttemptConflictError(
            'checkout_additional_data_missing',
        );
    }

    const replay = buildStripeCheckoutReplayInput({
        accountId,
        attempt,
        checkoutAdditionalDataByCartItemId,
        customerId,
        userId,
    });
    const stripeResult = await dependencies.checkout(
        account,
        replay.data,
        replay.options,
    );
    try {
        await dependencies.bindAttempt({
            attemptId: attempt.snapshot.attemptId,
            cartId: attempt.snapshot.cartId,
            sessionId: stripeResult.sessionId,
        });
    } catch (error) {
        const recoveredAttempt = await dependencies.getAttempt(
            attempt.snapshot.cartId,
            attempt.snapshot.attemptId,
        );
        if (recoveredAttempt?.sessionId !== stripeResult.sessionId) {
            throw error;
        }
    }
    return {
        status: 'open',
        sessionId: stripeResult.sessionId,
        url: stripeResult.url,
    };
}
