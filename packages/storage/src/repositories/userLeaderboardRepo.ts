import 'server-only';
import { and, asc, count, desc, eq, gt } from 'drizzle-orm';
import { users } from '../schema';
import { storage } from '../storage';
import { userAchievementCount } from './userAchievementProgress';

/** The same primary-account score is used on profiles and avatars.
 * Equal scores are ordered by registration date, then ID for stable ordering.
 */
export function getUserAchievementLeaderboard() {
    const achievementCount = userAchievementCount(users.id);
    return storage()
        .select({
            id: users.id,
            displayName: users.displayName,
            avatarUrl: users.avatarUrl,
            createdAt: users.createdAt,
            achievementCount: achievementCount.as('achievement_count'),
        })
        .from(users)
        .where(and(eq(users.isTemporary, false), gt(achievementCount, 0)))
        .orderBy(desc(achievementCount), asc(users.createdAt), asc(users.id))
        .limit(10);
}

/** Registered (non-temporary) users, used to show how many gardeners are not ranked in the top ten. */
export async function countRegisteredUsers() {
    const [result] = await storage()
        .select({ count: count() })
        .from(users)
        .where(eq(users.isTemporary, false));
    return result?.count ?? 0;
}
