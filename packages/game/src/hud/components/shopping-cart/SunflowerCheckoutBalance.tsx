import { Row } from '@gredice/ui/Row';
import { Typography } from '@gredice/ui/Typography';
import type { useShoppingCart } from '../../../hooks/useShoppingCart';
import { formatSunflowers } from '../../../utils/sunflowerPricing';

export function SunflowerCheckoutBalance({
    cart,
}: {
    cart: ReturnType<typeof useShoppingCart>['data'];
}) {
    const pendingSunflowers = cart?.totalSunflowers ?? 0;

    return (
        <div aria-live="polite">
            <Row justifyContent="space-between" spacing={4}>
                <Typography level="body1">Za plaćanje</Typography>
                <Typography level="body1" bold>
                    {formatSunflowers(pendingSunflowers)}{' '}
                    <span className="text-lg">🌻</span>
                </Typography>
            </Row>
        </div>
    );
}
