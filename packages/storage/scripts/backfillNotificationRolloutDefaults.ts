import { backfillNotificationRolloutDefaults } from '../src/repositories/notificationsRepo';

function readLimit(args: string[]) {
    const limitArg = args.find((arg) => arg.startsWith('--limit='));
    if (!limitArg) return undefined;

    const value = Number(limitArg.slice('--limit='.length));
    if (!Number.isInteger(value) || value <= 0) {
        throw new Error('--limit must be a positive integer');
    }

    return value;
}

const args = process.argv.slice(2);
const result = await backfillNotificationRolloutDefaults({
    dryRun: args.includes('--dry-run'),
    limit: readLimit(args),
});

console.log(JSON.stringify(result, null, 2));
