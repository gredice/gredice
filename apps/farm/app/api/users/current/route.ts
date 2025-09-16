import { getUser } from '@gredice/storage';

import { withAuth } from '../../../../lib/auth/auth';

export async function GET() {
    return await withAuth(['farmer', 'admin'], async ({ userId }) => {
        const dbUser = await getUser(userId);
        if (!dbUser) {
            return new Response(JSON.stringify({ error: 'User not found' }), {
                status: 404,
            });
        }

        return Response.json({
            id: dbUser.id,
            userName: dbUser.userName,
            displayName: dbUser.displayName ?? dbUser.userName,
            avatarUrl: dbUser.avatarUrl,
            role: dbUser.role,
            createdAt: dbUser.createdAt,
        });
    });
}
