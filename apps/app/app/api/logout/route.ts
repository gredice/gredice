import { clearCookie } from '../../../lib/auth/auth';

export async function POST() {
    await clearCookie();

    return new Response(null, { status: 200 });
}