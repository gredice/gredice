import { withAuth } from '../../../../lib/auth/auth';

export async function GET() {
    return await withAuth(['farmer', 'admin'], async ({ user }) => {
        return Response.json({
            id: user.id,
            userName: user.userName,
            role: user.role,
            accounts: user.accountIds.map((accountId) => ({ accountId })),
        });
    });
}
