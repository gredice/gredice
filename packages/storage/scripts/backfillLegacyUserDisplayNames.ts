import { backfillLegacyUserDisplayNames } from '../src/repositories/userDisplayNameBackfill';
import { closeStorage } from '../src/storage';

const argumentsSet = new Set(
    process.argv.slice(2).filter((arg) => arg !== '--'),
);
const cutoffArgument = [...argumentsSet].find((arg) =>
    arg.startsWith('--created-before='),
);
if (
    [...argumentsSet].some(
        (arg) =>
            !['--apply', '--all-social'].includes(arg) &&
            !arg.startsWith('--created-before='),
    ) ||
    (argumentsSet.has('--apply') && !cutoffArgument)
) {
    throw new Error(
        'Usage: backfillLegacyUserDisplayNames [--all-social] [--created-before=ISO] [--apply requires --created-before]',
    );
}

try {
    const result = await backfillLegacyUserDisplayNames({
        apply: argumentsSet.has('--apply'),
        ...(cutoffArgument
            ? {
                  createdBefore: new Date(
                      cutoffArgument.slice('--created-before='.length),
                  ),
              }
            : {}),
        scope: argumentsSet.has('--all-social') ? 'all-social' : 'untouched',
    });
    console.log(JSON.stringify(result));
} finally {
    await closeStorage();
}
