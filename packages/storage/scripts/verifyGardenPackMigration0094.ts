import { closeStorage } from '../src/storage';
import { verifyGardenPackMigration0094 } from './gardenPackMigration0094Verification';

try {
    console.info(
        'Garden pack migration readback verified.',
        await verifyGardenPackMigration0094(),
    );
} catch {
    // Driver errors may contain clients and connection strings.
    console.error(
        'Garden pack migration readback failed; inspect migration journal, source-owned guards and required indexes.',
    );
    process.exitCode = 1;
} finally {
    await closeStorage();
}
