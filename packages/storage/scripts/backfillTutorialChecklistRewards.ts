import { backfillTutorialChecklistRewards, closeStorage } from '../src/index';

function parseIntegerFlag(name: string, { min }: { min: number }) {
    const raw = process.argv
        .find((arg) => arg.startsWith(`--${name}=`))
        ?.slice(name.length + 3);
    if (!raw) {
        return undefined;
    }

    const parsed = Number.parseInt(raw, 10);
    if (!Number.isInteger(parsed) || parsed < min) {
        throw new Error(
            `--${name} must be an integer greater than or equal to ${min}.`,
        );
    }

    return parsed;
}

function parseAccountIds() {
    return process.argv
        .filter((arg) => arg.startsWith('--account-id='))
        .flatMap((arg) => arg.slice('--account-id='.length).split(','))
        .map((accountId) => accountId.trim())
        .filter(Boolean);
}

async function main() {
    const apply = process.argv.includes('--apply');
    const result = await backfillTutorialChecklistRewards({
        accountIds: parseAccountIds(),
        dryRun: !apply,
        limit: parseIntegerFlag('limit', { min: 1 }),
        offset: parseIntegerFlag('offset', { min: 0 }) ?? 0,
    });

    console.log(JSON.stringify(result, null, 2));
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await closeStorage();
    });
