import { Approved, Empty } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { cx } from '@signalco/ui-primitives/cx';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useClaimDailyReward } from '../../hooks/useClaimDailyReward';
import { useDailyReward } from '../../hooks/useDailyReward';

const rewards = [5, 10, 15, 20, 25, 50, 50];

export function DailyRewardOverview() {
    const { data } = useDailyReward();
    const claimDailyReward = useClaimDailyReward();
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
            <div className="grid md:grid-cols-7 grid-cols-4 gap-2">
                {columns.map((col) => {
                    const content = (
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
                            {col.isNext && (
                                <Button
                                    variant="solid"
                                    size="sm"
                                    className="text-xs px-2 py-1 mt-1"
                                    disabled={claimDailyReward.isPending}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        claimDailyReward.mutate();
                                    }}
                                >
                                    {claimDailyReward.isPending
                                        ? 'Preuzimam...'
                                        : 'Preuzmi'}
                                </Button>
                            )}
                        </Stack>
                    );

                    if (col.isNext) {
                        return (
                            <button
                                key={col.day}
                                type="button"
                                className={cx(
                                    'bg-primary-50 border border-primary-200 hover:bg-primary-100',
                                    'rounded-lg p-2 flex justify-center items-center h-full relative',
                                    'focus:ring-2 focus:ring-primary-300 focus:outline-none',
                                )}
                                onClick={() => claimDailyReward.mutate()}
                                disabled={claimDailyReward.isPending}
                            >
                                {content}
                            </button>
                        );
                    }

                    return (
                        <div
                            key={col.day}
                            className={cx(
                                col.isClaimed &&
                                    'bg-yellow-100 border border-yellow-300',
                                !col.isClaimed && 'bg-muted',
                                'rounded-lg p-2 flex justify-center items-center h-full',
                            )}
                        >
                            {content}
                        </div>
                    );
                })}
            </div>
        </Stack>
    );
}
