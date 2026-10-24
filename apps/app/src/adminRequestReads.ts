import 'server-only';

import { cache } from 'react';
import { recordAdminRead } from './adminRequestAttribution';

/** Shares a server read only within the current React render request. */
export function adminRequestRead<Result>(
    name: string,
    load: () => Promise<Result>,
    record = recordAdminRead,
) {
    return cache(async () => {
        const start = performance.now();
        let failed = true;
        try {
            const result = await load();
            failed = false;
            return result;
        } finally {
            await record(name, performance.now() - start, failed);
        }
    });
}
