import {
    backfillHarvestTraceLinksForCompletedHarvests,
    closeStorage,
    type HarvestTraceBackfillResult,
} from '../src/index';

function parseLimit() {
    const rawLimit = process.argv
        .find((arg) => arg.startsWith('--limit='))
        ?.slice('--limit='.length);
    if (!rawLimit) {
        return 1000;
    }

    const parsed = Number.parseInt(rawLimit, 10);
    if (!Number.isInteger(parsed) || parsed < 1) {
        throw new Error('--limit must be a positive integer.');
    }

    return parsed;
}

function emptyResult(dryRun: boolean): HarvestTraceBackfillResult {
    return {
        dryRun,
        scannedOperations: 0,
        harvestOperations: 0,
        targetLinks: 0,
        existingLinks: 0,
        createdLinks: 0,
        wouldCreateLinks: 0,
        skipped: {
            missingAccount: 0,
            missingGarden: 0,
            missingRaisedBed: 0,
            missingField: 0,
            missingPlantCycle: 0,
            unsupportedScope: 0,
            notCompleted: 0,
        },
    };
}

function addResult(
    total: HarvestTraceBackfillResult,
    page: HarvestTraceBackfillResult,
) {
    total.scannedOperations += page.scannedOperations;
    total.harvestOperations += page.harvestOperations;
    total.targetLinks += page.targetLinks;
    total.existingLinks += page.existingLinks;
    total.createdLinks += page.createdLinks;
    total.wouldCreateLinks += page.wouldCreateLinks;

    for (const key of Object.keys(total.skipped) as Array<
        keyof HarvestTraceBackfillResult['skipped']
    >) {
        total.skipped[key] += page.skipped[key];
    }
}

async function main() {
    const apply = process.argv.includes('--apply');
    const dryRun = !apply;
    const limit = parseLimit();
    const total = emptyResult(dryRun);

    for (let offset = 0; ; offset += limit) {
        const page = await backfillHarvestTraceLinksForCompletedHarvests({
            dryRun,
            limit,
            offset,
        });
        addResult(total, page);

        if (page.scannedOperations < limit) {
            break;
        }
    }

    console.log(JSON.stringify(total, null, 2));
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await closeStorage();
    });
