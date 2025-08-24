import 'server-only';
import { unstable_noStore as noStore } from 'next/cache';
import { createSource } from './generated/hypertune';
import { getContext } from './identify';

function getHypertuneToken() {
    const token = process.env.NEXT_PUBLIC_HYPERTUNE_TOKEN;
    if (!token) throw new Error('Missing Hypertune token');
    return token;
}

const hypertuneSource = createSource({
    token: getHypertuneToken(),
});

export async function getFlags() {
    noStore();
    await hypertuneSource.initIfNeeded(); // Check for flag updates
    const context = await getContext();

    return hypertuneSource.root({
        args: {
            context,
        },
    });
}
