import { auth } from '../../../lib/auth/auth';
import { getAdventTopUsers } from './actions';
import { OccasionsClient } from './OccasionsClient';

export default async function OccasionsPage() {
    await auth(['admin']);
    const topAdventUsers2025 = await getAdventTopUsers(2025);

    return <OccasionsClient topAdventUsers2025={topAdventUsers2025} />;
}
