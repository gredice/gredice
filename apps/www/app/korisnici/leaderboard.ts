import { clientPublic } from '@gredice/client';

export async function getUserLeaderboard() {
    const response = await clientPublic().api.users.public.leaderboard.$get(
        {},
        { init: { cache: 'no-store', signal: AbortSignal.timeout(10_000) } },
    );
    if (!response.ok) throw new Error('Ljestvica trenutačno nije dostupna.');
    return response.json();
}
