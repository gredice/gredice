import { Approved, Empty } from '@signalco/ui-icons';
import { cx } from '@signalco/ui-primitives/cx';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useDailyReward } from '../../hooks/useDailyReward';

const rewards = [5, 10, 15, 20, 25, 50, 50];

export function DailyRewardOverview() {
    const { data } = useDailyReward();
    if (!data) return null;

    const columns = rewards.map((amount, index) => {
        const day = index + 1;
        const entry = data.streak?.find((s) => s.day === day);
        const isClaimed = Boolean(entry);
        const isNext = data.canClaim && data.current.day === day;
        const dayLabel = day >= 7 ? '7+' : day;
        return {
            day,
            dayLabel,
            amount,
            isClaimed,
            isNext,
            claimedAt: entry?.claimedAt,
            expiresAt: isNext ? data.expiresAt : undefined,
        };
    });

    return (
        <Stack spacing={2}>
            <Typography level="body2" bold>
                Dnevna aktivnost
            </Typography>
            <div className="grid grid-cols-7 gap-2">
                {columns.map((col) => (
                    <div
                        key={col.day}
                        className={cx(
                            col.isClaimed &&
                                'bg-yellow-100 border border-yellow-300',
                            col.isNext &&
                                'bg-primary-50 border border-primary-200',
                            !col.isClaimed && !col.isNext && 'bg-muted',
                            'rounded-lg p-2 flex justify-center items-center h-full',
                        )}
                    >
                        <Stack spacing={1} alignItems="center">
                            {col.isClaimed ? (
                                <Approved className="size-5 text-green-600" />
                            ) : (
                                <Empty className="size-5 text-muted-foreground" />
                            )}
                            <Typography level="body3">{`Dan ${col.dayLabel}`}</Typography>
                            <Typography level="body2">
                                +{col.amount} 🌻
                            </Typography>
                        </Stack>
                    </div>
                ))}
            </div>
        </Stack>
    );
}
