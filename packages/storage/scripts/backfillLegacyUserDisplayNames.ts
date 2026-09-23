import { backfillLegacyUserDisplayNames } from '../src/repositories/userDisplayNameBackfill';
import { closeStorage } from '../src/storage';

const argumentsSet = new Set(process.argv.slice(2));
if (
    [...argumentsSet].some((arg) => !['--apply', '--all-social'].includes(arg))
) {
    throw new Error(
        'Usage: backfillLegacyUserDisplayNames [--apply] [--all-social]',
    );
}

try {
    const result = await backfillLegacyUserDisplayNames({
        apply: argumentsSet.has('--apply'),
        scope: argumentsSet.has('--all-social') ? 'all-social' : 'untouched',
    });
    console.log(JSON.stringify(result));
} finally {
    await closeStorage();
}
