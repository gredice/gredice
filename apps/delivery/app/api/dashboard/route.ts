import { withAuth } from '../../../lib/auth/auth';
import { getDeliveryDashboard } from '../../../lib/deliveryDashboard';

export const dynamic = 'force-dynamic';

export async function GET() {
    return await withAuth(
        ['user', 'farmer', 'driver', 'admin'],
        async ({ accountId, userId, user }) =>
            Response.json(
                await getDeliveryDashboard({
                    accountId,
                    userId,
                    role: user.role,
                }),
                { headers: { 'Cache-Control': 'no-store' } },
            ),
    );
}
