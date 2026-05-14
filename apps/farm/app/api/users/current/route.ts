import { getLastBirthdayRewardEvent, getUser } from '@gredice/storage';

import { withAuth } from '../../../../lib/auth/auth';

export async function GET() {
    return await withAuth(['farmer', 'admin'], async ({ userId }) => {
        const dbUser = await getUser(userId);
        if (!dbUser) {
            return new Response(JSON.stringify({ error: 'User not found' }), {
                status: 404,
            });
        }

        const lastRewardEvent = await getLastBirthdayRewardEvent(userId);
        const birthdayLastRewardAt = lastRewardEvent
            ? new Date(lastRewardEvent.data.rewardDate)
            : null;

        return Response.json({
            id: dbUser.id,
            userName: dbUser.userName,
            displayName: dbUser.displayName ?? dbUser.userName,
            avatarUrl: dbUser.avatarUrl,
            role: dbUser.role,
            birthday:
                dbUser.birthdayMonth && dbUser.birthdayDay
                    ? {
                          day: dbUser.birthdayDay,
                          month: dbUser.birthdayMonth,
                          year: dbUser.birthdayYear ?? undefined,
                      }
                    : null,
            birthdayLastUpdatedAt: dbUser.birthdayLastUpdatedAt,
            birthdayLastRewardAt,
            createdAt: dbUser.createdAt,
        });
    });
}
