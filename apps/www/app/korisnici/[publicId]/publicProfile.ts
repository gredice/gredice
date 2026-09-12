import { clientPublic } from '@gredice/client';
import {
    type AchievementCategory,
    type AchievementDefinition,
    getAchievementDefinition,
} from '@gredice/js/achievements';

export async function getPublicProfile(publicId: string) {
    const response = await clientPublic().api.users.public[
        ':publicId'
    ].profile.$get({ param: { publicId } });
    if (!response.ok) {
        throw new Error('Profil nije pronađen.');
    }
    return response.json();
}

export function getTopPublicAchievements(
    achievements: Pick<
        Awaited<ReturnType<typeof getPublicProfile>>['achievements'][number],
        'key' | 'status'
    >[],
) {
    const topByCategory = new Map<AchievementCategory, AchievementDefinition>();

    for (const achievement of achievements) {
        if (achievement.status !== 'approved') {
            continue;
        }
        const definition = getAchievementDefinition(achievement.key);
        if (!definition) {
            continue;
        }
        const current = topByCategory.get(definition.category);
        if (!current || definition.sortOrder > current.sortOrder) {
            topByCategory.set(definition.category, definition);
        }
    }

    return [...topByCategory.values()].sort(
        (first, second) => first.sortOrder - second.sortOrder,
    );
}
