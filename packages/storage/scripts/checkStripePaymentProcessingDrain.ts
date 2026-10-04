import { getStripePaymentProcessingDrainPreflight } from '../src/repositories/transactionsRepo';
import { closeStorage } from '../src/storage';

const boundedDiagnosticToken = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;

function boundedToken(value: unknown) {
    return typeof value === 'string' && boundedDiagnosticToken.test(value)
        ? value
        : undefined;
}

function safeErrorDiagnostic(error: unknown) {
    return {
        errorCode:
            typeof error === 'object' && error !== null && 'code' in error
                ? boundedToken(error.code)
                : undefined,
        errorName:
            boundedToken(error instanceof Error ? error.name : null) ??
            'Unknown',
    };
}

try {
    const drained = await getStripePaymentProcessingDrainPreflight();
    console.log(JSON.stringify({ drained }, null, 2));
    if (!drained) {
        process.exitCode = 2;
    }
} catch (error) {
    console.error('Failed to check Stripe payment processing drain state.', {
        ...safeErrorDiagnostic(error),
    });
    process.exitCode = 1;
} finally {
    try {
        await closeStorage();
    } catch (error) {
        console.error('Failed to close storage after the drain check.', {
            ...safeErrorDiagnostic(error),
        });
        process.exitCode = 1;
    }
}
