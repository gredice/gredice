import { test as base, expect } from '@playwright/experimental-ct-react';
import { blobNetworkGuard } from './blob-network-fixtures';

export const test = base.extend<{ blobNetworkGuard: undefined }>({
    serviceWorkers: 'block',
    blobNetworkGuard,
});
export { expect };
