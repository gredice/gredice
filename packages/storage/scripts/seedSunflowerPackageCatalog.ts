import { closeStorage, seedSunflowerPackageCatalog } from '../src';

async function main() {
    const results = await seedSunflowerPackageCatalog();
    console.info('Sunflower package catalog seed completed.', {
        packages: results,
    });
}

main()
    .catch((error) => {
        console.error('Sunflower package catalog seed failed.', { error });
        process.exitCode = 1;
    })
    .finally(async () => {
        await closeStorage();
    });
