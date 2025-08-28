import { after } from 'node:test';
import { closeStorage } from '../src/storage';

// Ensure DB connections are closed before the test process exits
after(async () => {
    await closeStorage();
});
