import { getAchievementDefinition } from '@gredice/js/achievements';
import { getAccountAchievements } from '@gredice/storage';
import {
    Card,
    CardContent,
    CardHeader,
    CardOverflow,
    CardTitle,
} from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import {
    scrollableTableCardClassName,
    scrollableTableCardOverflowClassName,
} from '../../../../components/admin/cards/tableCardLayout';
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
        <Card className={scrollableTableCardClassName}>
            <CardHeader>
                <CardTitle>Postignuća</CardTitle>
            </CardHeader>
            <CardContent>
                <Stack spacing={2}>
                    <Typography level="body2">
                        Ukupno {achievements.length} postignuća evidentirano.
                    </Typography>
                </Stack>
            </CardContent>
            <CardOverflow className={scrollableTableCardOverflowClassName}>
                {sorted.length === 0 ? (
                    <div className="p-4">
                        <NoDataPlaceholder>
                            Nema zabilježenih postignuća
                        </NoDataPlaceholder>
                    </div>
                ) : (
                    <ul className="divide-y">
                        {sorted.map((achievement) => {
                            const definition = getAchievementDefinition(
                                achievement.achievementKey,
                            );
                            const status = statusLabel(achievement.status);
                            return (
                                <li
                                    key={achievement.id}
                                    className="px-3 py-3 transition-colors hover:bg-muted/40 sm:px-4"
                                >
                                    <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                        <Stack
                                            spacing={1}
                                            className="min-w-0 flex-1"
                                        >
                                            <Typography
                                                level="body2"
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
                                                    {definition.description}
                                                </Typography>
                                            ) : null}
                                        </Stack>
                                        <div className="flex shrink-0 flex-col gap-2 lg:items-end">
                                            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                                                <Chip
                                                    size="sm"
                                                    variant="soft"
                                                    className={status.color}
                                                >
                                                    {status.label}
                                                </Chip>
                                                <Chip
                                                    color="neutral"
                                                    size="sm"
                                                    variant="outlined"
                                                >
                                                    🌻{' '}
                                                    {achievement.rewardSunflowers.toLocaleString(
                                                        'hr-HR',
                                                    )}
                                                </Chip>
                                            </div>
                                            <div className="flex flex-col gap-1 text-left lg:items-end lg:text-right">
                                                <Typography
                                                    component="div"
                                                    level="body3"
                                                    className="text-muted-foreground"
                                                >
                                                    Stečeno:{' '}
                                                    <LocalDateTime>
                                                        {achievement.earnedAt}
                                                    </LocalDateTime>
                                                </Typography>
                                                <Typography
                                                    component="div"
                                                    level="body3"
                                                    className="text-muted-foreground"
                                                >
                                                    Odobreno:{' '}
                                                    {achievement.approvedAt ? (
                                                        <LocalDateTime>
                                                            {
                                                                achievement.approvedAt
                                                            }
                                                        </LocalDateTime>
                                                    ) : (
                                                        '—'
                                                    )}
                                                </Typography>
                                            </div>
                                        </div>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </CardOverflow>
        </Card>
    );
}
