import type { Identify } from 'flags';
import { dedupe } from 'flags/next';
import type { Context } from './generated/hypertune';

export async function getContext() {
    return {
        environment: process.env.NODE_ENV,
    };
}

export const identify = dedupe((async () => {
    return await getContext();
}) satisfies Identify<Context>);
