import { Row } from '@signalco/ui-primitives/Row';
import { Typography } from '@signalco/ui-primitives/Typography';
import type { useShoppingCart } from '../../../hooks/useShoppingCart';

export function SunflowerCheckoutBalance({
    cart,
}: {
    cart: ReturnType<typeof useShoppingCart>['data'];
}) {
    const pendingSunflowers = cart?.totalSunflowers ?? 0;

    return (
        <div aria-live="polite">
            <Row justifyContent="space-between" spacing={2}>
                <Typography level="body1">Za plaćanje</Typography>
                <Typography level="body1" bold>
                    {formatSunflowers(pendingSunflowers)}{' '}
                    <span className="text-lg">🌻</span>
                </Typography>
            </Row>
        </div>
    );
}

function formatSunflowers(value: number) {
    return value.toLocaleString('hr-HR');
}
