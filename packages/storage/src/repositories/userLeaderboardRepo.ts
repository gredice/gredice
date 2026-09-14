import 'server-only';
import { and, asc, desc, eq, gt } from 'drizzle-orm';
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
