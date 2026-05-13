import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import type { useShoppingCart } from '../../../hooks/useShoppingCart';

export function SunflowerCheckoutBalance({
    cart,
}: {
    cart: ReturnType<typeof useShoppingCart>['data'];
}) {
    const pendingSunflowers = cart?.totalSunflowers ?? 0;

    return (
        <div
            className="rounded-2xl border border-yellow-200/80 bg-yellow-50/80 p-3 dark:border-yellow-700/60 dark:bg-yellow-950/30"
            aria-live="polite"
        >
            <Stack spacing={1}>
                <Row justifyContent="space-between" spacing={2}>
                    <Typography level="body2" semiBold>
                        Za plaćanje
                    </Typography>
                    <Typography
                        level="body1"
                        semiBold
                        className="text-yellow-700 dark:text-yellow-200"
                    >
                        {formatSunflowers(pendingSunflowers)} 🌻
                    </Typography>
                </Row>
            </Stack>
        </div>
    );
}

function formatSunflowers(value: number) {
    return value.toLocaleString('hr-HR');
}
