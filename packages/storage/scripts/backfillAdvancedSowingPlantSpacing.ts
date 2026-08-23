import { closeStorage } from '../src';
import {
    backfillAdvancedSowingPlantSpacing,
    parseAdvancedSowingPlantSpacingBackfillArgs,
} from './lib/advancedSowingPlantSpacingBackfill';

async function main() {
    const { apply } = parseAdvancedSowingPlantSpacingBackfillArgs(
        process.argv.slice(2),
    );
    return backfillAdvancedSowingPlantSpacing({ apply });
}

main()
    .then((report) => {
        console.info(JSON.stringify(report, null, 2));
    })
    .catch((error: unknown) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await closeStorage();
    });
