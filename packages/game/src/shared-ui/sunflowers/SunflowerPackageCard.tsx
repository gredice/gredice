import { Button } from '@gredice/ui/Button';
import { Card, CardContent } from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import { GameSunflowerIcon } from '@gredice/ui/GameIcons';
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
    const isPopular = pkg.tag === 'Najpopularnije';

    const breakdownRows = (
        <div className="space-y-1 py-1">
            <Row
                justifyContent="space-between"
                className="min-w-0 flex-col items-start gap-0 @[12rem]/package:flex-row @[12rem]/package:items-center @[12rem]/package:gap-3"
            >
                <Typography
                    level="body3"
                    className="text-[10px] leading-tight text-foreground/75 @[12rem]/package:whitespace-nowrap @[12rem]/package:text-xs"
                >
                    Osnovni iznos
                </Typography>
                <Typography
                    level="body3"
                    bold
                    className="shrink-0 whitespace-nowrap text-[10px] tabular-nums @[12rem]/package:text-xs"
                >
                    {formatSunflowers(pkg.baseSunflowers)}{' '}
                    <GameSunflowerIcon className="inline-block size-[1.2em] align-[-0.2em]" />
                </Typography>
            </Row>
            <Row
                justifyContent="space-between"
                className="min-w-0 flex-col items-start gap-0 @[12rem]/package:flex-row @[12rem]/package:items-center @[12rem]/package:gap-3"
            >
                <Typography
                    level="body3"
                    className="text-[10px] leading-tight text-primary @[12rem]/package:whitespace-nowrap @[12rem]/package:text-xs"
                >
                    Bonus {pkg.bonusPercentage} %
                </Typography>
                <Typography
                    level="body3"
                    bold
                    className="shrink-0 whitespace-nowrap text-[10px] text-primary tabular-nums @[12rem]/package:text-xs"
                >
                    + {formatSunflowers(pkg.bonusSunflowers)}{' '}
                    <GameSunflowerIcon className="inline-block size-[1.2em] align-[-0.2em]" />
                </Typography>
            </Row>
        </div>
    );

    return (
        <Card
            key={pkg.code}
            data-sunflower-package={pkg.code}
            className={cx(
                '@container/package relative min-w-0 border-tertiary/30 p-1',
                featured && 'col-span-3',
                featured && 'border-primary/40 bg-primary/5',
                isPopular &&
                    'border-amber-300 bg-amber-50/70 dark:border-amber-800 dark:bg-amber-950/40',
            )}
        >
            {pkg.tag ? (
                <Chip
                    data-package-tag
                    size="sm"
                    variant="soft"
                    color={isPopular ? 'warning' : 'neutral'}
                    className="absolute left-1/2 top-0 z-10 min-h-5 w-max max-w-[calc(100%-0.5rem)] -translate-x-1/2 -translate-y-1/2 justify-center whitespace-normal break-words px-1 py-0 text-center text-[9px] leading-tight @[12rem]/package:min-h-6 @[12rem]/package:whitespace-nowrap @[12rem]/package:px-1.5 @[12rem]/package:py-0.5 @[12rem]/package:text-xs"
                >
                    {pkg.tag}
                </Chip>
            ) : null}
            <CardContent noHeader className="h-full p-1.5 @[12rem]/package:p-2">
                <div className="flex h-full flex-col">
                    <SunflowerPackageVisual
                        packageCode={pkg.code}
                        className="mb-2 h-14 w-full shrink-0 @[12rem]/package:mb-3 @[12rem]/package:h-20"
                        aria-hidden
                    />
                    <div className="min-w-0">
                        <Typography
                            level="body1"
                            bold
                            className="min-w-0 text-xs leading-tight @[12rem]/package:text-base"
                        >
                            {pkg.name}
                        </Typography>
                        {pkg.descriptionShort ? (
                            <Typography
                                level="body3"
                                className="mt-1 hidden min-h-7 text-foreground/75 @[12rem]/package:block"
                            >
                                {pkg.descriptionShort}
                            </Typography>
                        ) : null}
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
                                        {formatSunflowers(pkg.sunflowers)}{' '}
                                        <GameSunflowerIcon className="inline-block size-[1.2em] align-[-0.2em]" />
                                    </Typography>
                                </div>
                            </div>

                            <details
                                data-package-breakdown="compact"
                                className="group mt-1 @[28rem]/package:hidden"
                            >
                                <summary className="flex cursor-pointer list-none flex-col items-start gap-0.5 py-2 @[12rem]/package:flex-row @[12rem]/package:items-center @[12rem]/package:justify-between @[12rem]/package:gap-2 [&::-webkit-details-marker]:hidden">
                                    <span className="min-w-0">
                                        <Typography
                                            level="body3"
                                            bold
                                            uppercase
                                            className="text-[10px] leading-tight text-foreground/75 @[12rem]/package:text-xs"
                                        >
                                            Ukupno
                                        </Typography>
                                    </span>
                                    <span className="flex shrink-0 items-center gap-1">
                                        <Typography
                                            level="body3"
                                            bold
                                            className="whitespace-nowrap text-[10px] tabular-nums @[12rem]/package:text-base"
                                        >
                                            {formatSunflowers(pkg.sunflowers)}{' '}
                                            <GameSunflowerIcon className="inline-block size-[1.2em] align-[-0.2em]" />
                                        </Typography>
                                        <ExpandDown className="size-3 text-foreground/75 transition-transform group-open:rotate-180 @[12rem]/package:size-4" />
                                    </span>
                                </summary>
                                <div className="pb-1 pt-0.5">
                                    {breakdownRows}
                                </div>
                            </details>
                        </>
                    ) : (
                        <div
                            data-package-total
                            className="mt-1 flex min-w-0 flex-col items-start justify-between gap-0.5 py-2 @[12rem]/package:flex-row @[12rem]/package:items-baseline @[12rem]/package:gap-3"
                        >
                            <Typography
                                level="body3"
                                bold
                                uppercase
                                className="shrink-0 whitespace-nowrap text-[10px] leading-tight text-foreground/75 @[12rem]/package:text-xs"
                            >
                                Ukupno
                            </Typography>
                            <Typography
                                level="body3"
                                bold
                                className="whitespace-nowrap text-[10px] tabular-nums @[12rem]/package:text-base"
                            >
                                {formatSunflowers(pkg.sunflowers)}{' '}
                                <GameSunflowerIcon className="inline-block size-[1.2em] align-[-0.2em]" />
                            </Typography>
                        </div>
                    )}

                    <div className="mt-auto pt-2 @[12rem]/package:pt-3">
                        <Button
                            data-package-cta
                            size="sm"
                            fullWidth
                            variant={isPopular ? 'solid' : 'soft'}
                            className="px-1 tabular-nums @[12rem]/package:px-3"
                            disabled={disabled}
                            loading={loading}
                            onClick={onSelect}
                        >
                            <span className="sr-only">
                                Odaberi {pkg.name} za{' '}
                            </span>
                            <span data-package-price>{packagePrice(pkg)}</span>
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
