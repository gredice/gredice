import { getAchievementDefinition } from '@gredice/js/achievements';
import { getAccountAchievements } from '@gredice/storage';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import {
    Card,
    CardContent,
    CardHeader,
    CardOverflow,
    CardTitle,
} from '@signalco/ui-primitives/Card';
import { Divider } from '@signalco/ui-primitives/Divider';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Table } from '@signalco/ui-primitives/Table';
import { Typography } from '@signalco/ui-primitives/Typography';
import { NoDataPlaceholder } from '../../../../components/shared/placeholders/NoDataPlaceholder';

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

export async function AccountAchievementsCard({
    accountId,
}: {
    accountId: string;
}) {
    const achievements = await getAccountAchievements(accountId);
    const sorted = achievements.sort(
        (a, b) => b.earnedAt.getTime() - a.earnedAt.getTime(),
    );

    return (
        <Card>
            <CardHeader>
                <CardTitle>Postignuća</CardTitle>
            </CardHeader>
            <CardContent>
                <Stack spacing={1}>
                    <Typography level="body2">
                        Ukupno {achievements.length} postignuća evidentirano.
                    </Typography>
                </Stack>
            </CardContent>
            <CardOverflow>
                <Divider />
                <div className="max-h-80 overflow-auto">
                    <Table>
                        <Table.Header>
                            <Table.Row>
                                <Table.Head>Postignuće</Table.Head>
                                <Table.Head>Status</Table.Head>
                                <Table.Head>Nagrada</Table.Head>
                                <Table.Head>Stečeno</Table.Head>
                                <Table.Head>Odobreno</Table.Head>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {sorted.length === 0 && (
                                <Table.Row>
                                    <Table.Cell colSpan={5}>
                                        <NoDataPlaceholder>
                                            Nema zabilježenih postignuća
                                        </NoDataPlaceholder>
                                    </Table.Cell>
                                </Table.Row>
                            )}
                            {sorted.map((achievement) => {
                                const definition = getAchievementDefinition(
                                    achievement.achievementKey,
                                );
                                const status = statusLabel(achievement.status);
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
                                                    {definition?.description}
                                                </Typography>
                                            </Stack>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <Typography
                                                className={status.color}
                                            >
                                                {status.label}
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
                                    </Table.Row>
                                );
                            })}
                        </Table.Body>
                    </Table>
                </div>
            </CardOverflow>
        </Card>
    );
}
