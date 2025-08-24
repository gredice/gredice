import 'server-only';
import { unstable_noStore as noStore } from 'next/cache';
import { createSource } from './generated/hypertune';

function getHypertuneToken() {
    const token = process.env.NEXT_PUBLIC_HYPERTUNE_TOKEN;
    if (!token) throw new Error('Missing Hypertune token');
    return token;
}

const hypertuneSource = createSource({
    token: getHypertuneToken(),
});

export default async function getHypertune() {
    noStore();
    await hypertuneSource.initIfNeeded(); // Check for flag updates

    return hypertuneSource.root({
        args: {
            context: {
                environment: process.env.NODE_ENV,
                user: { id: '1', name: 'Test', email: 'hi@test.com' },
            },
        },
    });
}
