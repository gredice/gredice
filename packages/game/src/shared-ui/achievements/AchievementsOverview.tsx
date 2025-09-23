'use client';

import { getAchievementDefinitions } from '@gredice/js/achievements';
import { Card, CardContent } from '@signalco/ui-primitives/Card';
import { Row } from '@signalco/ui-primitives/Row';
import { Spinner } from '@signalco/ui-primitives/Spinner';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useMemo } from 'react';
import {
    type AccountAchievement,
    useAccountAchievements,
} from '../../hooks/useAccountAchievements';

const categoryLabels: Record<string, string> = {
    registration: 'Dobrodošlica',
    planting: 'Sijanje',
    watering: 'Zalijevanje',
    harvest: 'Berba',
};

const statusStyles: Record<
    'locked' | AccountAchievement['status'],
    { label: string; color: string }
> = {
    locked: { label: 'Zaključano', color: 'text-muted-foreground' },
    pending: { label: 'Na čekanju', color: 'text-yellow-500' },
    approved: { label: 'Odobreno', color: 'text-green-600' },
    denied: { label: 'Odbijeno', color: 'text-red-500' },
};

export function AchievementsOverview() {
    const achievementsQuery = useAccountAchievements();

    const achievementsByKey = useMemo(() => {
        const map = new Map<string, AccountAchievement>();
        for (const achievement of achievementsQuery.data ?? []) {
            map.set(achievement.key, achievement);
        }
        return map;
    }, [achievementsQuery.data]);

    const definitionsByCategory = useMemo(() => {
        const groups = new Map<
            string,
            ReturnType<typeof getAchievementDefinitions>[number][]
        >();
        for (const definition of getAchievementDefinitions().sort(
            (a, b) => a.sortOrder - b.sortOrder,
        )) {
            const categoryGroup = groups.get(definition.category) ?? [];
            categoryGroup.push(definition);
            groups.set(definition.category, categoryGroup);
        }
        return groups;
    }, []);

    if (achievementsQuery.isLoading) {
        return (
            <div className="flex justify-center py-10">
                <Spinner loadingLabel="Učitavanje postignuća" />
            </div>
        );
    }

    if (achievementsQuery.error) {
        return (
            <Typography level="body2" color="danger">
                Postignuća trenutno nisu dostupna. Pokušaj ponovno kasnije.
            </Typography>
        );
    }

    return (
        <Stack spacing={4}>
            {Array.from(definitionsByCategory.entries()).map(
                ([category, definitions]) => {
                    const label = categoryLabels[category] ?? category;
                    return (
                        <Stack key={category} spacing={2}>
                            <Typography level="h5">{label}</Typography>
                            <Stack spacing={2}>
                                {definitions.map((definition) => {
                                    const achievement = achievementsByKey.get(
                                        definition.key,
                                    );
                                    const status = achievement
                                        ? statusStyles[achievement.status]
                                        : statusStyles.locked;
                                    const earnedAt = achievement?.earnedAt
                                        ? new Date(achievement.earnedAt)
                                        : null;
                                    const approvedAt = achievement?.approvedAt
                                        ? new Date(achievement.approvedAt)
                                        : null;
                                    return (
                                        <Card
                                            key={definition.key}
                                            className={`border ${
                                                achievement ? '' : 'opacity-70'
                                            }`}
                                        >
                                            <CardContent noHeader>
                                                <Row
                                                    justifyContent="space-between"
                                                    spacing={4}
                                                >
                                                    <Stack spacing={1}>
                                                        <Typography
                                                            level="body1"
                                                            semiBold
                                                        >
                                                            {definition.title}
                                                        </Typography>
                                                        <Typography
                                                            level="body3"
                                                            secondary
                                                        >
                                                            {
                                                                definition.description
                                                            }
                                                        </Typography>
                                                        {earnedAt && (
                                                            <Typography
                                                                level="body3"
                                                                secondary
                                                            >
                                                                Stečeno:{' '}
                                                                {earnedAt.toLocaleDateString(
                                                                    'hr-HR',
                                                                    {
                                                                        day: 'numeric',
                                                                        month: 'long',
                                                                        year: 'numeric',
                                                                    },
                                                                )}
                                                            </Typography>
                                                        )}
                                                        {approvedAt && (
                                                            <Typography
                                                                level="body3"
                                                                secondary
                                                            >
                                                                Odobreno:{' '}
                                                                {approvedAt.toLocaleDateString(
                                                                    'hr-HR',
                                                                    {
                                                                        day: 'numeric',
                                                                        month: 'long',
                                                                        year: 'numeric',
                                                                    },
                                                                )}
                                                            </Typography>
                                                        )}
                                                        {!achievement && (
                                                            <Typography
                                                                level="body3"
                                                                secondary
                                                            >
                                                                Ispuni uvjete
                                                                kako bi
                                                                otključao ovo
                                                                postignuće.
                                                            </Typography>
                                                        )}
                                                    </Stack>
                                                    <Stack
                                                        spacing={1}
                                                        alignItems="flex-end"
                                                    >
                                                        <Typography level="body2">
                                                            🌻{' '}
                                                            {definition.rewardSunflowers.toLocaleString(
                                                                'hr-HR',
                                                            )}
                                                        </Typography>
                                                        <Typography
                                                            level="body3"
                                                            className={
                                                                status.color
                                                            }
                                                        >
                                                            {status.label}
                                                        </Typography>
                                                    </Stack>
                                                </Row>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </Stack>
                        </Stack>
                    );
                },
            )}
        </Stack>
    );
}
