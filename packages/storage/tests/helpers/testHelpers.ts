import { createFarm, getFarms, getAccount, createAccount as storageCreateAccount, createAccount, getAccounts } from '@gredice/storage';
import { accounts } from '../../src/schema/usersSchema';

/**
 * Helper to create a garden for tests
 * @param opts - { name, accountId, farmId }
 */
export async function createTestGarden(opts: { name?: string; accountId: string; farmId: number }) {
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
            latitude: 0
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
