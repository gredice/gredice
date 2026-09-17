import { Button } from '@gredice/ui/Button';
import { Card, CardContent } from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import { ExpandDown } from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';
import { SunflowerPackageVisual } from '@gredice/ui/SunflowerVisuals';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import type { SunflowerPackageData } from '../../hooks/useSunflowerPackages';
import { formatSunflowers } from '../../utils/sunflowerPricing';

const euroFormatter = new Intl.NumberFormat('hr-HR', {
    currency: 'EUR',
    style: 'currency',
});

function packagePrice(pkg: SunflowerPackageData) {
    return euroFormatter.format(pkg.priceCents / 100);
}

export function SunflowerPackageCard({
    pkg,
    featured = false,
    disabled = false,
    loading = false,
    onSelect,
}: {
    pkg: SunflowerPackageData;
    featured?: boolean;
    disabled?: boolean;
    loading?: boolean;
    onSelect: () => void;
}) {
    const hasBonus = pkg.bonusSunflowers > 0;
    const isBestValue = pkg.tag === 'Najbolja vrijednost';

    const breakdownRows = (
        <div className="space-y-0.5">
            <Row justifyContent="space-between" className="min-w-0 gap-3">
                <Typography
                    level="body3"
                    className="whitespace-nowrap text-foreground/75"
                >
                    Osnovni iznos
                </Typography>
                <Typography
                    level="body3"
                    bold
                    className="shrink-0 whitespace-nowrap tabular-nums"
                >
                    {formatSunflowers(pkg.baseSunflowers)} 🌻
                </Typography>
            </Row>
            <Row justifyContent="space-between" className="min-w-0 gap-3">
                <Typography
                    level="body3"
                    className="whitespace-nowrap text-primary"
                >
                    Bonus {pkg.bonusPercentage} %
                </Typography>
                <Typography
                    level="body3"
                    bold
                    className="shrink-0 whitespace-nowrap text-primary tabular-nums"
                >
                    + {formatSunflowers(pkg.bonusSunflowers)} 🌻
                </Typography>
            </Row>
        </div>
    );

    return (
        <Card
            key={pkg.code}
            data-sunflower-package={pkg.code}
            className={cx(
                '@container/package min-w-0 border-tertiary/30',
                featured &&
                    '@[36rem]/sunflower-packages:col-span-2 @[50rem]/sunflower-packages:col-span-3',
                featured && 'border-primary/40 bg-primary/5',
                isBestValue && 'border-primary/40 bg-primary/[0.03]',
            )}
        >
            <CardContent noHeader className="h-full">
                <div className="flex h-full flex-col">
                    <SunflowerPackageVisual
                        packageCode={pkg.code}
                        className="mb-3 h-20 w-full shrink-0"
                        aria-hidden
                    />
                    <div className="min-w-0">
                        <Row
                            justifyContent="space-between"
                            alignItems="start"
                            className="min-w-0 gap-2"
                        >
                            <Typography level="body1" bold className="min-w-0">
                                {pkg.name}
                            </Typography>
                            {pkg.tag ? (
                                <Chip size="sm" variant="soft">
                                    {pkg.tag}
                                </Chip>
                            ) : null}
                        </Row>
                        <Row
                            justifyContent="space-between"
                            alignItems="start"
                            spacing={2}
                            className="mt-1 min-h-7"
                        >
                            {pkg.descriptionShort ? (
                                <Typography
                                    level="body3"
                                    className="min-w-0 flex-1 text-foreground/75"
                                >
                                    {pkg.descriptionShort}
                                </Typography>
                            ) : (
                                <span />
                            )}
                            <Typography level="body1" bold>
                                <span className="sr-only">Cijena: </span>
                                <span className="whitespace-nowrap tabular-nums">
                                    {packagePrice(pkg)}
                                </span>
                            </Typography>
                        </Row>
                    </div>

                    {hasBonus ? (
                        <>
                            <div
                                data-package-breakdown="desktop"
                                className="mt-1 hidden rounded-lg border bg-muted/20 p-3 @[28rem]/package:block"
                            >
                                <Typography
                                    level="body3"
                                    bold
                                    uppercase
                                    className="mb-0.5 text-foreground/75"
                                >
                                    Sadržaj paketa
                                </Typography>
                                {breakdownRows}
                                <div className="mt-1.5 flex items-baseline justify-between gap-3 border-t pt-1.5">
                                    <Typography
                                        level="body3"
                                        bold
                                        uppercase
                                        className="shrink-0 whitespace-nowrap text-foreground/75"
                                    >
                                        Ukupno
                                    </Typography>
                                    <Typography
                                        level="h4"
                                        className="whitespace-nowrap text-right tabular-nums"
                                    >
                                        {formatSunflowers(pkg.sunflowers)} 🌻
                                    </Typography>
                                </div>
                            </div>

                            <details
                                data-package-breakdown="compact"
                                className="group mt-1 rounded-lg border bg-muted/20 @[28rem]/package:hidden"
                            >
                                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 [&::-webkit-details-marker]:hidden">
                                    <span className="min-w-0">
                                        <Typography
                                            level="body3"
                                            bold
                                            uppercase
                                            className="text-foreground/75"
                                        >
                                            Ukupno
                                        </Typography>
                                    </span>
                                    <span className="flex shrink-0 items-center gap-2">
                                        <Typography
                                            level="body1"
                                            bold
                                            className="whitespace-nowrap tabular-nums"
                                        >
                                            {formatSunflowers(pkg.sunflowers)}{' '}
                                            🌻
                                        </Typography>
                                        <ExpandDown className="size-4 text-foreground/75 transition-transform group-open:rotate-180" />
                                    </span>
                                </summary>
                                <div className="border-t px-3 py-2">
                                    {breakdownRows}
                                </div>
                            </details>
                        </>
                    ) : (
                        <div
                            data-package-total
                            className="mt-1 flex items-baseline justify-between gap-3 rounded-lg bg-muted/20 px-3 py-2"
                        >
                            <Typography
                                level="body3"
                                bold
                                uppercase
                                className="shrink-0 whitespace-nowrap text-foreground/75"
                            >
                                Ukupno
                            </Typography>
                            <Typography
                                level="body1"
                                bold
                                className="whitespace-nowrap tabular-nums"
                            >
                                {formatSunflowers(pkg.sunflowers)} 🌻
                            </Typography>
                        </div>
                    )}

                    <div className="mt-auto pt-3">
                        <Button
                            size="sm"
                            fullWidth
                            variant={isBestValue ? 'solid' : 'soft'}
                            disabled={disabled}
                            loading={loading}
                            onClick={onSelect}
                        >
                            Odaberi
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
