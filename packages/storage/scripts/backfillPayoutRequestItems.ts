import { backfillPayoutRequestItems, closeStorage } from '../src';

function hasFlag(flag: string) {
    return process.argv.includes(flag);
}

const main = async () => {
    const dryRun = hasFlag('--dry-run');
    const result = await backfillPayoutRequestItems({ dryRun });

    console.info('Payout request item backfill completed.', result);
};

main()
    .catch((error) => {
        console.error('Payout request item backfill failed.', { error });
        process.exitCode = 1;
    })
    .finally(async () => {
        await closeStorage();
    });
