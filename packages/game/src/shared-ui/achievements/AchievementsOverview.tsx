'use client';

import { getAchievementDefinitions } from '@gredice/js/achievements';
import { Card, CardContent } from '@signalco/ui-primitives/Card';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { Modal } from '@signalco/ui-primitives/Modal';
import { Row } from '@signalco/ui-primitives/Row';
import { Spinner } from '@signalco/ui-primitives/Spinner';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useMemo, useState } from 'react';
import { useAccountAchievements } from '../../hooks/useAccountAchievements';

type AccountAchievement = NonNullable<
    ReturnType<typeof useAccountAchievements>['data']
>[number];

const categoryLabels: Record<string, string> = {
    registration: 'Dobrodošlica',
    plants: 'Biljke',
};

const statusStyles: Record<
    'locked' | AccountAchievement['status'],
    { label: string; color: string }
> = {
    locked: { label: '🔒 Zaključano', color: 'text-muted-foreground' },
    pending: { label: '⏳ Na čekanju', color: 'text-yellow-500' },
    approved: { label: '✅ Odobreno', color: 'text-green-600' },
    denied: { label: '❌ Odbijeno', color: 'text-red-500' },
};

export function AchievementsOverview() {
    const achievementsQuery = useAccountAchievements();
    const [selectedAchievement, setSelectedAchievement] = useState<{
        definition: ReturnType<typeof getAchievementDefinitions>[number];
        achievement?: AccountAchievement;
        status: { label: string; color: string };
    } | null>(null);

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

    const handleAchievementClick = (
        definition: ReturnType<typeof getAchievementDefinitions>[number],
        achievement?: AccountAchievement,
    ) => {
        const status = achievement
            ? statusStyles[achievement.status]
            : statusStyles.locked;

        setSelectedAchievement({ definition, achievement, status });
    };

    const renderTrophyButton = (
        definition: ReturnType<typeof getAchievementDefinitions>[number],
        achievement?: AccountAchievement,
        isLocked: boolean = false,
    ) => {
        return (
            <div
                key={definition.key}
                className="flex flex-col items-center space-y-2"
            >
                <IconButton
                    variant="plain"
                    className={`
                        size-16 rounded-full border-2 transition-all duration-200 hover:scale-105
                        ${
                            achievement
                                ? achievement.status === 'approved'
                                    ? 'bg-yellow-100 border-yellow-400 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:border-yellow-600'
                                    : achievement.status === 'pending'
                                      ? 'bg-blue-100 border-blue-400 hover:bg-blue-200 dark:bg-blue-900/30 dark:border-blue-600'
                                      : 'bg-red-100 border-red-400 hover:bg-red-200 dark:bg-red-900/30 dark:border-red-600'
                                : 'bg-gray-100 border-gray-300 hover:bg-gray-200 dark:bg-gray-800 dark:border-gray-600 opacity-80'
                        }
                    `}
                    onClick={() =>
                        handleAchievementClick(definition, achievement)
                    }
                    title={isLocked ? 'Skriveno postignuće' : definition.title}
                >
                    <span className="text-2xl text-yellow-400 font-semibold">
                        {isLocked ? '?' : '🏆'}
                    </span>
                </IconButton>
                {!isLocked && (
                    <Typography
                        level="body3"
                        className="text-center max-w-20 truncate"
                    >
                        {definition.title}
                    </Typography>
                )}
                {isLocked && (
                    <Typography
                        level="body3"
                        className="text-center text-muted-foreground"
                    >
                        ?
                    </Typography>
                )}
            </div>
        );
    };

    return (
        <>
            <div className="overflow-y-auto max-h-[calc(100dvh-15rem)] md:max-h-[calc(100dvh-24rem)]">
                <Stack spacing={1}>
                    {Array.from(definitionsByCategory.entries()).map(
                        ([category, definitions]) => {
                            const label = categoryLabels[category] ?? category;
                            return (
                                <Card key={category}>
                                    <CardContent noHeader>
                                        <Stack spacing={3}>
                                            <Typography
                                                level="h5"
                                                className="text-center"
                                            >
                                                {label}
                                            </Typography>
                                            <div className="flex justify-center">
                                                <div className="flex flex-wrap items-center justify-center gap-4">
                                                    {definitions.map(
                                                        (definition) => {
                                                            const achievement =
                                                                achievementsByKey.get(
                                                                    definition.key,
                                                                );
                                                            const isLocked =
                                                                !achievement;

                                                            return renderTrophyButton(
                                                                definition,
                                                                achievement,
                                                                isLocked,
                                                            );
                                                        },
                                                    )}
                                                </div>
                                            </div>
                                        </Stack>
                                    </CardContent>
                                </Card>
                            );
                        },
                    )}
                </Stack>
            </div>

            {/* Achievement Details Modal */}
            <Modal
                open={Boolean(selectedAchievement)}
                onOpenChange={(open) => {
                    if (!open) setSelectedAchievement(null);
                }}
                title="Postignuće"
                className="max-w-md"
            >
                {selectedAchievement && (
                    <Stack spacing={4}>
                        {/* Trophy Icon */}
                        <div className="flex justify-center">
                            <div
                                className={`
                                size-20 rounded-full border-4 flex items-center justify-center
                                ${
                                    selectedAchievement.achievement
                                        ? selectedAchievement.achievement
                                              .status === 'approved'
                                            ? 'bg-yellow-100 border-yellow-400 dark:bg-yellow-900/30 dark:border-yellow-600'
                                            : selectedAchievement.achievement
                                                    .status === 'pending'
                                              ? 'bg-blue-100 border-blue-400 dark:bg-blue-900/30 dark:border-blue-600'
                                              : 'bg-red-100 border-red-400 dark:bg-red-900/30 dark:border-red-600'
                                        : 'bg-gray-100 border-gray-300 dark:bg-gray-800 dark:border-gray-600 opacity-60'
                                }
                            `}
                            >
                                <span className="text-4xl text-yellow-400 font-semibold">
                                    {selectedAchievement.achievement
                                        ? '🏆'
                                        : '?'}
                                </span>
                            </div>
                        </div>

                        {/* Achievement Info */}
                        <Stack spacing={2}>
                            <Typography level="h4" className="text-center">
                                {selectedAchievement.achievement
                                    ? selectedAchievement.definition.title
                                    : 'Skriveno postignuće'}
                            </Typography>

                            <Typography
                                level="body2"
                                className="w-2/3 text-balance text-center self-center"
                            >
                                {selectedAchievement.achievement
                                    ? selectedAchievement.definition.description
                                    : 'Ispuni uvjete kako bi otključao ovo postignuće i vidio detalje.'}
                            </Typography>

                            {/* Status and Reward */}
                            <Card>
                                <CardContent noHeader>
                                    <Row
                                        justifyContent="space-between"
                                        spacing={4}
                                    >
                                        <Stack spacing={1}>
                                            <Typography level="body3" secondary>
                                                Status
                                            </Typography>
                                            <Typography
                                                level="body2"
                                                className={
                                                    selectedAchievement.status
                                                        .color
                                                }
                                            >
                                                {
                                                    selectedAchievement.status
                                                        .label
                                                }
                                            </Typography>
                                        </Stack>

                                        {selectedAchievement.achievement && (
                                            <Stack spacing={1}>
                                                <Typography
                                                    level="body3"
                                                    secondary
                                                >
                                                    Nagrada
                                                </Typography>
                                                <Typography level="body2">
                                                    🌻{' '}
                                                    {selectedAchievement.definition.rewardSunflowers.toLocaleString(
                                                        'hr-HR',
                                                    )}
                                                </Typography>
                                            </Stack>
                                        )}
                                    </Row>
                                </CardContent>
                            </Card>

                            {/* Grant Date */}
                            {selectedAchievement.achievement
                                ?.rewardGrantedAt && (
                                <Card>
                                    <CardContent noHeader>
                                        <Stack spacing={1}>
                                            <Typography level="body3" secondary>
                                                Postignuto
                                            </Typography>
                                            <Typography level="body2">
                                                {new Date(
                                                    selectedAchievement
                                                        .achievement
                                                        .rewardGrantedAt,
                                                ).toLocaleDateString('hr-HR', {
                                                    day: 'numeric',
                                                    month: 'long',
                                                    year: 'numeric',
                                                })}
                                            </Typography>
                                        </Stack>
                                    </CardContent>
                                </Card>
                            )}
                        </Stack>
                    </Stack>
                )}
            </Modal>
        </>
    );
}
