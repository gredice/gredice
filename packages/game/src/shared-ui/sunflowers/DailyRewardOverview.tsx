import { Approved, Empty } from '@signalco/ui-icons';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useDailyReward } from '../../hooks/useDailyReward';

const rewards = [5, 10, 15, 20, 25, 50, 50];

export function DailyRewardOverview() {
    const { data } = useDailyReward();
    if (!data) return null;

    const columns = rewards.map((amount, index) => {
        const day = index + 1;
        const entry = data.streak?.find((s: any) => s.day === day);
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
                    <Stack key={col.day} spacing={1} alignItems="center">
                        {col.isClaimed ? (
                            <Approved className="size-5 text-success-600" />
                        ) : (
                            <Empty className="size-5 text-muted-foreground" />
                        )}
                        <Typography level="body3">{`Dan ${col.dayLabel}`}</Typography>
                        <Typography level="body2">+{col.amount}</Typography>
                        {col.isClaimed && col.claimedAt && (
                            <Typography level="caption" className="text-center">
                                {new Date(col.claimedAt).toLocaleDateString('hr-HR', {
                                    day: 'numeric',
                                    month: 'short',
                                })}{' '}
                                {new Date(col.claimedAt).toLocaleTimeString('hr-HR', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                })}
                            </Typography>
                        )}
                        {!col.isClaimed && col.isNext && col.expiresAt && (
                            <Typography level="caption" className="text-center">
                                {`Ističe ${new Date(col.expiresAt).toLocaleDateString('hr-HR', {
                                    day: 'numeric',
                                    month: 'short',
                                })} ${new Date(col.expiresAt).toLocaleTimeString('hr-HR', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                })}`}
                            </Typography>
                        )}
                    </Stack>
                ))}
            </div>
        </Stack>
    );
}
