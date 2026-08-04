import {
    fingerprintStripeCheckoutValue,
    getAccount,
    getAccountUsers,
    type StripeCheckoutAttempt,
    StripeCheckoutAttemptConflictError,
    verifyStripeCheckoutAttemptLiveCart,
} from '@gredice/storage';
import {
    decodeExpectedNonStripeCartItemIdsMetadata,
    decodeHarvestDatesMetadata,
} from './harvestCheckout';
import {
    assertStripeSessionMatchesCheckoutAttempt,
    decodeStripeCheckoutAttemptMetadata,
    type StripeCheckoutSessionForSnapshot,
} from './stripeCheckoutSnapshot';

export type StripeCheckoutSessionForReconciliation =
    StripeCheckoutSessionForSnapshot & {
        metadata: Record<string, string> | null;
        paymentStatus: 'no_payment_required' | 'paid' | 'unpaid';
        status: 'complete' | 'expired' | 'open' | null;
        url: string | null;
    };

export type StripeCheckoutAttemptIdentity = {
    accountId: string;
    customerId: string;
    userId: string;
};

export type StripeCheckoutAttemptValidationDependencies = {
    getAccount: (
        accountId: string,
    ) => Promise<{ stripeCustomerId: string | null } | undefined>;
    getAccountUsers: (
        accountId: string,
    ) => Promise<readonly { userId: string }[]>;
    verifyLiveCart: (
        attempt: StripeCheckoutAttempt,
    ) => Promise<{ accountId: string }>;
};

const realDependencies: StripeCheckoutAttemptValidationDependencies = {
    getAccount,
    getAccountUsers,
    verifyLiveCart: verifyStripeCheckoutAttemptLiveCart,
};

export async function resolveStripeCheckoutAttemptIdentity(
    attempt: StripeCheckoutAttempt,
    dependencies: StripeCheckoutAttemptValidationDependencies = realDependencies,
): Promise<StripeCheckoutAttemptIdentity> {
    const liveCart = await dependencies.verifyLiveCart(attempt);
    const account = await dependencies.getAccount(liveCart.accountId);
    const customerId = account?.stripeCustomerId;
    if (
        !customerId ||
        fingerprintStripeCheckoutValue(customerId) !==
            attempt.snapshot.stripeSession.customerFingerprint
    ) {
        throw new StripeCheckoutAttemptConflictError(
            'checkout_identity_changed',
        );
    }

    const matchingUsers = (
        await dependencies.getAccountUsers(liveCart.accountId)
    )
        .map((accountUser) => accountUser.userId)
        .filter(
            (userId) =>
                fingerprintStripeCheckoutValue(userId) ===
                attempt.snapshot.userFingerprint,
        );
    const userId = matchingUsers[0];
    if (matchingUsers.length !== 1 || !userId) {
        throw new StripeCheckoutAttemptConflictError('checkout_user_inactive');
    }

    return { accountId: liveCart.accountId, customerId, userId };
}

function assertSessionMetadataMatchesAttempt(
    session: StripeCheckoutSessionForReconciliation,
    attempt: StripeCheckoutAttempt,
) {
    const metadata = decodeStripeCheckoutAttemptMetadata(session.metadata);
    if (
        !metadata ||
        metadata.attemptId !== attempt.snapshot.attemptId ||
        metadata.cartId !== attempt.snapshot.cartId
    ) {
        throw new StripeCheckoutAttemptConflictError(
            'snapshot_identity_changed',
        );
    }

    let nonStripeItemIds: Set<number> | null;
    try {
        nonStripeItemIds = decodeExpectedNonStripeCartItemIdsMetadata(
            session.metadata,
        );
    } catch {
        throw new StripeCheckoutAttemptConflictError(
            'non_stripe_metadata_changed',
        );
    }
    if (
        nonStripeItemIds === null ||
        nonStripeItemIds.size !==
            attempt.snapshot.expectedNonStripeCartItemIds.length ||
        attempt.snapshot.expectedNonStripeCartItemIds.some(
            (itemId) => !nonStripeItemIds?.has(itemId),
        )
    ) {
        throw new StripeCheckoutAttemptConflictError(
            'non_stripe_metadata_changed',
        );
    }

    let harvestDates: Map<number, string>;
    try {
        harvestDates = decodeHarvestDatesMetadata(session.metadata);
    } catch {
        throw new StripeCheckoutAttemptConflictError(
            'harvest_metadata_changed',
        );
    }
    if (
        harvestDates.size !== attempt.snapshot.harvestDates.length ||
        attempt.snapshot.harvestDates.some(
            (selection) =>
                harvestDates.get(selection.cartItemId) !==
                selection.scheduledDate,
        )
    ) {
        throw new StripeCheckoutAttemptConflictError(
            'harvest_metadata_changed',
        );
    }
}

export async function validateStripeCheckoutSessionAgainstAttempt({
    attempt,
    dependencies = realDependencies,
    session,
}: {
    attempt: StripeCheckoutAttempt;
    dependencies?: StripeCheckoutAttemptValidationDependencies;
    session: StripeCheckoutSessionForReconciliation;
}): Promise<StripeCheckoutAttemptIdentity> {
    assertSessionMetadataMatchesAttempt(session, attempt);
    const identity = await resolveStripeCheckoutAttemptIdentity(
        attempt,
        dependencies,
    );
    assertStripeSessionMatchesCheckoutAttempt(session, attempt, identity);
    return identity;
}
