import { Card, CardOverflow } from '@gredice/ui/Card';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import { dashboardChartColors } from './dashboardChartColors';
import {
    formatDashboardNumber,
    formatDashboardPercent,
} from './dashboardFormat';

export function ActiveUsersCard({
    daily,
    weekly,
    monthly,
    users,
}: {
    daily: number;
    weekly: number;
    monthly: number;
    users: number;
}) {
    const rows = [
        { key: 'daily', abbreviation: 'DAU', window: '24 h', value: daily },
        { key: 'weekly', abbreviation: 'WAU', window: '7 dana', value: weekly },
        {
            key: 'monthly',
            abbreviation: 'MAU',
            window: '30 dana',
            value: monthly,
        },
    ];

    return (
        <Card className="h-full">
            <CardOverflow className="h-full">
                <div className="flex h-full flex-col gap-3 p-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                        <Typography level="h3" semiBold className="text-sm">
                            Aktivni korisnici
                        </Typography>
                        <Typography
                            level="body3"
                            className="text-muted-foreground"
                        >
                            Udio od {formatDashboardNumber(users)} korisnika
                        </Typography>
                    </div>
                    <ul className="mt-auto grid grid-cols-3 gap-3">
                        {rows.map((row) => {
                            const ratio =
                                users > 0 ? Math.min(row.value / users, 1) : 0;

                            return (
                                <li
                                    key={row.key}
                                    className="flex min-w-0 flex-col gap-1"
                                >
                                    <span className="truncate text-xs text-muted-foreground">
                                        <span className="font-medium text-foreground">
                                            {row.abbreviation}
                                        </span>{' '}
                                        · {row.window}
                                    </span>
                                    <span className="flex flex-wrap items-baseline gap-x-1">
                                        <span className="text-lg font-semibold">
                                            {formatDashboardNumber(row.value)}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {formatDashboardPercent(ratio)}
                                        </span>
                                    </span>
                                    <div
                                        aria-hidden
                                        className="h-2 overflow-hidden rounded-full bg-accent"
                                    >
                                        <div
                                            className={cx(
                                                'h-full rounded-full',
                                                row.value > 0 && 'min-w-1',
                                                dashboardChartColors.primary,
                                            )}
                                            style={{ width: `${ratio * 100}%` }}
                                        />
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            </CardOverflow>
        </Card>
    );
}
