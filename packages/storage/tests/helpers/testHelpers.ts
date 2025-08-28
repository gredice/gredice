import {
    createAccount,
    createFarm,
    createGardenBlock,
    getFarms,
} from '@gredice/storage';

/**
 * Helper to create a garden for tests
 * @param opts - { name, accountId, farmId }
 */
export async function createTestGarden(opts: {
    name?: string;
    accountId: string;
    farmId: number;
}) {
    const { name = 'Test Garden', accountId, farmId } = opts;
    // Import createGarden only when used to avoid circular deps in helpers
    const { createGarden } = await import('@gredice/storage');
    return await createGarden({ name, accountId, farmId });
}

export async function ensureFarmId() {
    const farms = await getFarms();
    if (farms.length === 0) {
        return await createFarm({
            name: 'Default Farm',
            longitude: 0,
            latitude: 0,
        });
    }
    return farms[0].id;
}

/**
 * Ensures test accounts with required IDs exist for tests.
 */
export async function createTestAccount() {
    // Always create a new account for each test to ensure isolation
    return await createAccount();
}

/**
 * Helper to create a raised bed for tests
 * @param gardenId - The garden ID where the raised bed will be created
 * @param accountId - The account ID associated with the raised bed
 * @param blockId - The block ID where the raised bed will be located
 */
export async function createTestRaisedBed(
    gardenId: number,
    accountId: string,
    blockId: string,
) {
    const { createRaisedBed } = await import('@gredice/storage');
    return await createRaisedBed({
        accountId,
        gardenId,
        blockId,
        status: 'new',
    });
}

export async function createTestBlock(gardenId: number, blockName: string) {
    return await createGardenBlock(gardenId, blockName);
}
