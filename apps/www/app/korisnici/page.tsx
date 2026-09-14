import { createPublicMetadata } from '../../lib/seo/publicMetadata';
import { KnownPages } from '../../src/KnownPages';
import { getUserLeaderboard } from './leaderboard';
import { UserLeaderboard } from './UserLeaderboard';

export const dynamic = 'force-dynamic';
export const metadata = createPublicMetadata({
    title: 'Top 10 vrtlara i njihova postignuća',
    description:
        'Upoznaj 10 Gredice korisnika s najviše odobrenih postignuća. Otkrij njihove vrtove, razine i iskustvo stečeno vrtlarenjem.',
    path: KnownPages.Users,
});

export default async function UsersPage() {
    return <UserLeaderboard {...(await getUserLeaderboard())} />;
}
