import { client } from '@gredice/client';
import type { Identify } from 'flags';
import { dedupe } from 'flags/next';
import type { Context } from './generated/hypertune';

export async function getContext() {
    try {
        // Your own logic to identify the user
        // Identifying the user should rely on reading cookies and headers only, and
        // not make any network requests, as it's important to keep latency low here.
        const response = await client().api.users.current.$get();
        if (!response.ok) {
            throw new Error(
                `Failed to fetch user - got NOK response: ${response.status}`,
            );
        }
        const user = await response.json();

        return {
            user: {
                email: user?.userName,
                id: user?.id,
                name: user?.displayName ?? user?.userName,
            },
            environment: process.env.NODE_ENV,
        };
    } catch {
        return {
            user: {
                email: 'unknown',
                id: 'unknown',
                name: 'unknown',
            },
            environment: process.env.NODE_ENV,
        };
    }
}

export const identify = dedupe((async () => {
    return await getContext();
}) satisfies Identify<Context>);