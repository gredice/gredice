import { getAchievementDefinitions } from '@gredice/js/achievements';
import { type AnyColumn, getTableName, sql } from 'drizzle-orm';

/** Correlated subquery also works in aliased Drizzle relational projections.
 * Explicit identifiers preserve the outer table/relational alias even when
 * Drizzle removes column qualifiers from a single-table SELECT projection.
 * A user's earliest membership defines the primary account, including ties.
 */
export function userAchievementCount(userId: AnyColumn) {
    const qualifiedUserId = sql`${sql.identifier(getTableName(userId.table))}.${sql.identifier(userId.name)}`;
    const keys = sql.join(
        getAchievementDefinitions().map(({ key }) => sql`${key}`),
        sql`, `,
    );
    return sql<number>`(
        select count(*)::int from account_achievements as progress_achievements
        where progress_achievements.account_id = (
            select progress_membership.account_id from account_users as progress_membership
            where progress_membership.user_id = ${qualifiedUserId}
            order by progress_membership.created_at, progress_membership.id
            limit 1
        )
        and progress_achievements.status = 'approved'
        and progress_achievements.achievement_key in (${keys})
    )`.mapWith(Number);
}

export function userAchievementExtras(user: { id: AnyColumn }) {
    return {
        achievementCount: userAchievementCount(user.id).as('achievement_count'),
    };
}
