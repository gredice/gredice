import { closeStorage } from '../src';
import {
    backfillPlantMaxHarvestDaysBeforeDelivery,
    parsePlantMaxHarvestDaysBackfillArgs,
} from './lib/plantMaxHarvestDaysBeforeDelivery';

async function main() {
    const { apply } = parsePlantMaxHarvestDaysBackfillArgs(
        process.argv.slice(2),
    );
    return backfillPlantMaxHarvestDaysBeforeDelivery({ apply });
}

main()
    .then((report) => {
        console.log(JSON.stringify(report, null, 2));
    })
    .catch((error: unknown) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await closeStorage();
    });
