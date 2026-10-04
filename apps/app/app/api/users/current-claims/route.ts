import { getUser } from '@gredice/storage';
import { withAuth } from '../../../../lib/auth/auth';

export async function GET() {
    return await withAuth(['admin'], async ({ user }) => {
        const profile = await getUser(user.id);
        return Response.json({
            id: user.id,
            userName: user.userName,
            avatarUrl: profile?.avatarUrl,
            achievementCount: profile?.achievementCount,
            role: user.role,
            accounts: user.accountIds.map((accountId) => ({ accountId })),
        });
    });
}
