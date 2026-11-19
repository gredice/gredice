import { clientPublic } from '@gredice/client';
import { AVATAR_OPTIONS } from '@gredice/ui/AvatarSelectionMenu';
import { readLeaderboardEditors } from './communityContributions';

export async function getUserLeaderboard() {
    const response = await clientPublic().api.users.public.leaderboard.$get(
        {},
        { init: { cache: 'no-store', signal: AbortSignal.timeout(10_000) } },
    );
    if (!response.ok) throw new Error('Ljestvica trenutačno nije dostupna.');
    const leaderboard = await response.json();
    // An API from before the editors ranking simply has none to show.
    return { ...leaderboard, editors: readLeaderboardEditors(leaderboard) };
}

/** A random handful of built-in avatars that stand in for the gardeners outside the top ten. */
export function pickCommunityAvatarUrls(count: number) {
    const urls = AVATAR_OPTIONS.map(({ avatarUrl }) => avatarUrl);
    for (let index = urls.length - 1; index > 0; index--) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [urls[index], urls[swapIndex]] = [urls[swapIndex], urls[index]];
    }
    return urls.slice(0, count);
}
