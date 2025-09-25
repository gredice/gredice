import {
    getAchievementDefinition,
    getAchievementDefinitions,
} from '@gredice/js/achievements';
import { getAchievements } from '@gredice/storage';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Button } from '@signalco/ui-primitives/Button';
import {
    Card,
    CardContent,
    CardHeader,
    CardOverflow,
    CardTitle,
} from '@signalco/ui-primitives/Card';
import { Divider } from '@signalco/ui-primitives/Divider';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Table } from '@signalco/ui-primitives/Table';
import { Typography } from '@signalco/ui-primitives/Typography';
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

function resolveStatus(value: string | undefined): StatusFilter {
    if (!value) return 'pending';
    const normalized = value.toLowerCase();
    return statusFilters.some((status) => status.value === normalized)
        ? (normalized as StatusFilter)
        : 'pending';
}

function statusLabel(status: string) {
    switch (status) {
        case 'approved':
            return { label: 'Odobreno', color: 'text-green-600' };
        case 'pending':
            return { label: 'Na čekanju', color: 'text-yellow-600' };
        case 'denied':
            return { label: 'Odbijeno', color: 'text-red-600' };
        default:
            return { label: status, color: 'text-muted-foreground' };
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
        <Stack spacing={4}>
            <Stack spacing={2}>
                <Typography level="h1" semiBold>
                    Postignuća
                </Typography>
                <Typography level="body2">
                    Pregled najnovijih postignuća i ručno odobravanje nagrada.
                </Typography>
            </Stack>
            <Row spacing={2}>
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
                    <Divider />
                    <div className="overflow-auto">
                        <Table>
                            <Table.Header>
                                <Table.Row>
                                    <Table.Head>Postignuće</Table.Head>
                                    <Table.Head>Račun</Table.Head>
                                    <Table.Head>Status</Table.Head>
                                    <Table.Head>Nagrada</Table.Head>
                                    <Table.Head>Stečeno</Table.Head>
                                    <Table.Head>Odobreno</Table.Head>
                                    <Table.Head>Radnja</Table.Head>
                                </Table.Row>
                            </Table.Header>
                            <Table.Body>
                                {achievements.length === 0 && (
                                    <Table.Row>
                                        <Table.Cell colSpan={7}>
                                            <NoDataPlaceholder>
                                                Nema postignuća za prikaz
                                            </NoDataPlaceholder>
                                        </Table.Cell>
                                    </Table.Row>
                                )}
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
                                    return (
                                        <Table.Row key={achievement.id}>
                                            <Table.Cell>
                                                <Stack spacing={1}>
                                                    <Typography
                                                        level="body2"
                                                        semiBold
                                                    >
                                                        {definition?.title ??
                                                            achievement.achievementKey}
                                                    </Typography>
                                                    <Typography
                                                        level="body3"
                                                        secondary
                                                    >
                                                        {
                                                            definition?.description
                                                        }
                                                    </Typography>
                                                </Stack>
                                            </Table.Cell>
                                            <Table.Cell>
                                                <Link
                                                    href={KnownPages.Account(
                                                        achievement.accountId,
                                                    )}
                                                    className="text-primary"
                                                >
                                                    {achievement.accountId}
                                                </Link>
                                            </Table.Cell>
                                            <Table.Cell>
                                                <Typography
                                                    className={statusInfo.color}
                                                >
                                                    {statusInfo.label}
                                                </Typography>
                                            </Table.Cell>
                                            <Table.Cell>
                                                🌻{' '}
                                                {achievement.rewardSunflowers.toLocaleString(
                                                    'hr-HR',
                                                )}
                                            </Table.Cell>
                                            <Table.Cell>
                                                <LocalDateTime>
                                                    {achievement.earnedAt}
                                                </LocalDateTime>
                                            </Table.Cell>
                                            <Table.Cell>
                                                {achievement.approvedAt ? (
                                                    <LocalDateTime>
                                                        {achievement.approvedAt}
                                                    </LocalDateTime>
                                                ) : (
                                                    <Typography
                                                        level="body3"
                                                        secondary
                                                    >
                                                        —
                                                    </Typography>
                                                )}
                                            </Table.Cell>
                                            <Table.Cell>
                                                {achievement.status ===
                                                'pending' ? (
                                                    <Row spacing={1}>
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
                                                        —
                                                    </Typography>
                                                )}
                                            </Table.Cell>
                                        </Table.Row>
                                    );
                                })}
                            </Table.Body>
                        </Table>
                    </div>
                </CardOverflow>
            </Card>
        </Stack>
    );
}
