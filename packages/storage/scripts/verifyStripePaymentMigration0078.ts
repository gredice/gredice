import {
    runStripePaymentMigration0078Readback,
    stripePaymentMigrationErrorDiagnostic,
} from './stripePaymentMigration0078Verification';

function postgresUrl() {
    const connectionString = process.env.POSTGRES_URL;
    if (!connectionString) {
        throw new Error('POSTGRES_URL environment variable is not set.');
    }
    return connectionString;
}

try {
    const result = await runStripePaymentMigration0078Readback(postgresUrl());
    console.info('Stripe payment migration readback verified.', result);
} catch (error) {
    console.error(
        'Stripe payment migration readback failed.',
        stripePaymentMigrationErrorDiagnostic(error),
    );
    process.exitCode = 1;
}
