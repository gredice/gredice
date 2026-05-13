import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useCurrentAccount } from '../../../hooks/useCurrentAccount';
import type { useShoppingCart } from '../../../hooks/useShoppingCart';

export function SunflowerCheckoutBalance({
    cart,
}: {
    cart: ReturnType<typeof useShoppingCart>['data'];
}) {
    const { data: account, isLoading } = useCurrentAccount();
    const currentSunflowers = account?.sunflowers.amount;
    const pendingSunflowers = cart?.totalSunflowers ?? 0;
    const remainingSunflowers =
        typeof currentSunflowers === 'number'
            ? currentSunflowers - pendingSunflowers
            : undefined;

    return (
        <div
            className="rounded-2xl border border-yellow-200/80 bg-yellow-50/80 p-3 dark:border-yellow-700/60 dark:bg-yellow-950/30"
            aria-live="polite"
        >
            <Stack spacing={1}>
                <Row justifyContent="space-between" spacing={2}>
                    <Typography level="body2" semiBold>
                        Suncokreti
                    </Typography>
                    <Typography
                        level="body2"
                        className="text-yellow-700 dark:text-yellow-200"
                    >
                        🌻
                    </Typography>
                </Row>
                <div className="grid gap-2 sm:grid-cols-3">
                    <SunflowerBalanceValue
                        label="Trenutno"
                        value={
                            isLoading
                                ? 'Učitavanje...'
                                : formatSunflowers(currentSunflowers)
                        }
                    />
                    <SunflowerBalanceValue
                        label="Za plaćanje"
                        value={`-${formatSunflowers(pendingSunflowers)}`}
                    />
                    <SunflowerBalanceValue
                        label="Nakon kupnje"
                        value={formatSunflowers(remainingSunflowers)}
                    />
                </div>
            </Stack>
        </div>
    );
}

function SunflowerBalanceValue({
    label,
    value,
}: {
    label: string;
    value: string;
}) {
    return (
        <Stack spacing={0.25} className="min-w-0">
            <Typography level="body3" secondary>
                {label}
            </Typography>
            <Typography level="body1" semiBold noWrap>
                {value} 🌻
            </Typography>
        </Stack>
    );
}

function formatSunflowers(value: number | undefined) {
    return typeof value === 'number' ? value.toLocaleString('hr-HR') : '—';
}
