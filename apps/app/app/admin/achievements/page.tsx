import {
    getAchievementDefinition,
    getAchievementDefinitions,
} from '@gredice/js/achievements';
import { getAchievements } from '@gredice/storage';
import { Button } from '@gredice/ui/Button';
import {
    Card,
    CardContent,
    CardHeader,
    CardOverflow,
    CardTitle,
} from '@gredice/ui/Card';
import { Chip, type ColorPaletteProp } from '@gredice/ui/Chip';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import Link from 'next/link';
import { NoDataPlaceholder } from '../../../components/shared/placeholders/NoDataPlaceholder';
import { auth } from '../../../lib/auth/auth';
import { KnownPages } from '../../../src/KnownPages';
import {
    approveAchievementAction,
    denyAchievementAction,
} from '../../(actions)/achievementActions';

const statusFilters = [
    { value: 'pending', label: 'Na čekanju' },
    { value: 'approved', label: 'Odobreno' },
    { value: 'denied', label: 'Odbijeno' },
    { value: 'all', label: 'Sve' },
] as const;

type StatusFilter = (typeof statusFilters)[number]['value'];

function isStatusFilter(value: string): value is StatusFilter {
    return statusFilters.some((status) => status.value === value);
}

function resolveStatus(value: string | undefined): StatusFilter {
    if (!value) return 'pending';
    const normalized = value.toLowerCase();
    return isStatusFilter(normalized) ? normalized : 'pending';
}

function statusLabel(status: string): {
    label: string;
    color: ColorPaletteProp;
} {
    switch (status) {
        case 'approved':
            return { label: 'Odobreno', color: 'success' };
        case 'pending':
            return { label: 'Na čekanju', color: 'warning' };
        case 'denied':
            return { label: 'Odbijeno', color: 'error' };
        default:
            return { label: status, color: 'neutral' };
    }
}

export default async function AchievementsPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    await auth(['admin']);
    const params = await searchParams;
    const status = resolveStatus(
        typeof params.status === 'string' ? params.status : undefined,
    );

    const storageStatus = status === 'all' ? undefined : status;
    const achievements = await getAchievements({ status: storageStatus });
    const definitions = getAchievementDefinitions();
    const definitionsMap = new Map(
        definitions.map((definition) => [definition.key, definition]),
    );

    return (
        <Stack spacing={8}>
            <Stack spacing={4}>
                <Typography level="body2">
                    Pregled najnovijih postignuća i ručno odobravanje nagrada.
                </Typography>
            </Stack>
            <Row spacing={4} className="flex-wrap">
                {statusFilters.map((filter) => {
                    const isActive = status === filter.value;
                    const href =
                        filter.value === 'pending'
                            ? KnownPages.Achievements
                            : {
                                  pathname: KnownPages.Achievements,
                                  query: { status: filter.value },
                              };
                    return (
                        <Link
                            key={filter.value}
                            href={href}
                            className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                                isActive
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'text-muted-foreground border-border hover:border-primary'
                            }`}
                        >
                            {filter.label}
                        </Link>
                    );
                })}
            </Row>
            <Card>
                <CardHeader>
                    <CardTitle>Zahtjevi</CardTitle>
                </CardHeader>
                <CardContent>
                    <Typography level="body2">
                        Ukupno {achievements.length} postignuća u prikazu.
                    </Typography>
                </CardContent>
                <CardOverflow>
                    {achievements.length === 0 ? (
                        <div className="p-4">
                            <NoDataPlaceholder>
                                Nema postignuća za prikaz
                            </NoDataPlaceholder>
                        </div>
                    ) : (
                        <ul className="divide-y">
                            {achievements.map((achievement) => {
                                const definition =
                                    definitionsMap.get(
                                        achievement.achievementKey,
                                    ) ??
                                    getAchievementDefinition(
                                        achievement.achievementKey,
                                    );
                                const statusInfo = statusLabel(
                                    achievement.status,
                                );
                                const reward =
                                    achievement.rewardSunflowers.toLocaleString(
                                        'hr-HR',
                                    );

                                return (
                                    <li
                                        key={achievement.id}
                                        className="px-3 py-3 transition-colors hover:bg-muted/40 sm:px-4"
                                    >
                                        <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                            <Stack
                                                spacing={2}
                                                className="min-w-0 flex-1"
                                            >
                                                <Stack spacing={1}>
                                                    <Typography
                                                        level="body2"
                                                        component="h3"
                                                        semiBold
                                                        className="min-w-0 break-words"
                                                    >
                                                        {definition?.title ??
                                                            achievement.achievementKey}
                                                    </Typography>
                                                    {definition?.description ? (
                                                        <Typography
                                                            level="body3"
                                                            secondary
                                                            className="min-w-0 break-words"
                                                        >
                                                            {
                                                                definition.description
                                                            }
                                                        </Typography>
                                                    ) : null}
                                                </Stack>
                                                <Typography
                                                    component="div"
                                                    level="body3"
                                                    className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground"
                                                >
                                                    <span>Račun</span>
                                                    <Link
                                                        href={KnownPages.Account(
                                                            achievement.accountId,
                                                        )}
                                                        title={
                                                            achievement.accountId
                                                        }
                                                        className="min-w-0 max-w-full break-all font-mono text-primary underline-offset-4 hover:underline"
                                                    >
                                                        {achievement.accountId}
                                                    </Link>
                                                </Typography>
                                            </Stack>
                                            <div className="flex min-w-0 flex-col gap-3 lg:items-end lg:text-right">
                                                <div className="flex min-w-0 flex-wrap items-center gap-2 lg:justify-end">
                                                    <Chip
                                                        color={statusInfo.color}
                                                        size="sm"
                                                        variant="soft"
                                                    >
                                                        {statusInfo.label}
                                                    </Chip>
                                                    <Chip
                                                        color="success"
                                                        size="sm"
                                                        variant="outlined"
                                                    >
                                                        Nagrada: 🌻 {reward}
                                                    </Chip>
                                                </div>
                                                <div className="grid min-w-0 grid-cols-1 gap-1 sm:grid-cols-2 lg:justify-items-end">
                                                    <Typography
                                                        component="div"
                                                        level="body3"
                                                        className="text-muted-foreground"
                                                    >
                                                        Stečeno:{' '}
                                                        <span className="whitespace-nowrap text-foreground">
                                                            <LocalDateTime>
                                                                {
                                                                    achievement.earnedAt
                                                                }
                                                            </LocalDateTime>
                                                        </span>
                                                    </Typography>
                                                    <Typography
                                                        component="div"
                                                        level="body3"
                                                        className="text-muted-foreground"
                                                    >
                                                        Odobreno:{' '}
                                                        {achievement.approvedAt ? (
                                                            <span className="whitespace-nowrap text-foreground">
                                                                <LocalDateTime>
                                                                    {
                                                                        achievement.approvedAt
                                                                    }
                                                                </LocalDateTime>
                                                            </span>
                                                        ) : (
                                                            <span>—</span>
                                                        )}
                                                    </Typography>
                                                </div>
                                                {achievement.status ===
                                                'pending' ? (
                                                    <Row
                                                        spacing={2}
                                                        className="flex-wrap lg:justify-end"
                                                    >
                                                        <form
                                                            action={approveAchievementAction.bind(
                                                                null,
                                                                achievement.id,
                                                            )}
                                                        >
                                                            <Button
                                                                type="submit"
                                                                size="sm"
                                                                variant="solid"
                                                            >
                                                                Odobri
                                                            </Button>
                                                        </form>
                                                        <form
                                                            action={denyAchievementAction.bind(
                                                                null,
                                                                achievement.id,
                                                            )}
                                                        >
                                                            <Button
                                                                type="submit"
                                                                size="sm"
                                                                variant="outlined"
                                                            >
                                                                Odbij
                                                            </Button>
                                                        </form>
                                                    </Row>
                                                ) : (
                                                    <Typography
                                                        level="body3"
                                                        secondary
                                                    >
                                                        Radnja: —
                                                    </Typography>
                                                )}
                                            </div>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </CardOverflow>
            </Card>
        </Stack>
    );
}
