'use client';

import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { Card, CardContent } from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import { useSearchParam } from '@gredice/ui/hooks';
import { AI, Check, ExpandDown } from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useGameAnalytics } from '../../analytics/GameAnalyticsContext';
import { currentAccountKeys } from '../../hooks/useCurrentAccount';
import {
    SunflowerPackageCheckoutError,
    useSunflowerPackageCheckout,
} from '../../hooks/useSunflowerPackageCheckout';
import {
    type SunflowerPackageData,
    sunflowerPackageKeys,
    useSunflowerPackages,
} from '../../hooks/useSunflowerPackages';
import { formatSunflowers } from '../../utils/sunflowerPricing';

const euroFormatter = new Intl.NumberFormat('hr-HR', {
    currency: 'EUR',
    style: 'currency',
});

function packagesByCodes(
    packages: SunflowerPackageData[],
    codes: string[] | undefined,
) {
    const byCode = new Map(packages.map((pkg) => [pkg.code, pkg]));
    return (codes ?? [])
        .map((code) => byCode.get(code) ?? null)
        .filter((pkg) => pkg !== null);
}

function packagePrice(pkg: SunflowerPackageData) {
    return euroFormatter.format(pkg.priceCents / 100);
}

export function SunflowerPackagesPanel() {
    const { data, isError, isLoading } = useSunflowerPackages();
    const checkout = useSunflowerPackageCheckout();
    const queryClient = useQueryClient();
    const { track } = useGameAnalytics();
    const [returnStatus, setReturnStatus] = useSearchParam('status');
    const [checkoutStatus, setCheckoutStatus] = useState<
        'success' | 'cancel' | null
    >(null);
    const [activeCheckoutCode, setActiveCheckoutCode] = useState<string | null>(
        null,
    );
    const [upsellTriggerCode, setUpsellTriggerCode] = useState<string | null>(
        null,
    );
    const didTrackCatalogView = useRef(false);

    useEffect(() => {
        if (returnStatus !== 'success' && returnStatus !== 'cancel') {
            return;
        }
        setCheckoutStatus(returnStatus);
        setReturnStatus(undefined);
        queryClient.invalidateQueries({ queryKey: currentAccountKeys });
        queryClient.invalidateQueries({ queryKey: sunflowerPackageKeys });
    }, [queryClient, returnStatus, setReturnStatus]);

    const packages = data?.packages ?? [];
    const initialOffers = useMemo(
        () =>
            packagesByCodes(packages, data?.groups.initialOffer).filter(
                (pkg) => pkg.eligible,
            ),
        [data?.groups.initialOffer, packages],
    );
    const mainPackages = useMemo(
        () => packagesByCodes(packages, data?.groups.main),
        [data?.groups.main, packages],
    );

    useEffect(() => {
        if (!data || didTrackCatalogView.current) {
            return;
        }
        didTrackCatalogView.current = true;
        track('sunflower_package_catalog_viewed', {
            package_count: data.packages.length,
            initial_offer_count: initialOffers.length,
            main_package_count: mainPackages.length,
        });
    }, [data, initialOffers.length, mainPackages.length, track]);

    const upsellPackage = packages.find(
        (pkg) =>
            pkg.role === 'upsell' &&
            pkg.upsellTriggerCode === upsellTriggerCode &&
            pkg.eligible,
    );
    const upsellTriggerPackage = mainPackages.find(
        (pkg) => pkg.code === upsellTriggerCode,
    );

    function startCheckout(
        pkg: SunflowerPackageData,
        source: 'direct' | 'upsell_accept' | 'upsell_decline',
    ) {
        setActiveCheckoutCode(pkg.code);
        track('sunflower_package_selected', {
            package_code: pkg.code,
            package_role: pkg.role,
            price_cents: pkg.priceCents,
            source,
            sunflowers: pkg.sunflowers,
        });
        if (source === 'upsell_accept') {
            track('sunflower_package_upsell_accepted', {
                package_code: pkg.code,
                trigger_package_code: pkg.upsellTriggerCode,
            });
        }
        if (source === 'upsell_decline') {
            track('sunflower_package_upsell_declined', {
                package_code: pkg.code,
                upsell_package_code: upsellPackage?.code ?? null,
            });
        }
        checkout.mutate(
            { code: pkg.code },
            {
                onSettled: () => setActiveCheckoutCode(null),
            },
        );
    }

    function handleMainPackage(pkg: SunflowerPackageData) {
        const nextUpsell = packages.find(
            (candidate) =>
                candidate.role === 'upsell' &&
                candidate.upsellTriggerCode === pkg.code &&
                candidate.eligible,
        );
        if (!nextUpsell) {
            startCheckout(pkg, 'direct');
            return;
        }
        setUpsellTriggerCode(pkg.code);
        track('sunflower_package_upsell_shown', {
            package_code: nextUpsell.code,
            trigger_package_code: pkg.code,
        });
    }

    function packageCard(pkg: SunflowerPackageData, featured = false) {
        const disabled = !pkg.eligible || checkout.isPending;
        const hasBonus = pkg.bonusSunflowers > 0;
        const isBestValue = pkg.tag === 'Najbolja vrijednost';

        const breakdownRows = (
            <div className="space-y-0.5">
                <Row justifyContent="space-between">
                    <Typography level="body3" className="text-muted-foreground">
                        Osnovni iznos
                    </Typography>
                    <Typography
                        level="body3"
                        bold
                        className="whitespace-nowrap tabular-nums"
                    >
                        {formatSunflowers(pkg.baseSunflowers)} 🌻
                    </Typography>
                </Row>
                <Row justifyContent="space-between">
                    <Typography level="body3" className="text-primary">
                        Bonus {pkg.bonusPercentage} %
                    </Typography>
                    <Typography
                        level="body3"
                        bold
                        className="whitespace-nowrap text-primary tabular-nums"
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
                    'border-tertiary/30 md:min-w-0',
                    featured && 'md:col-span-3',
                    featured && 'border-primary/40 bg-primary/5',
                )}
            >
                <CardContent noHeader className="h-full">
                    <div className="flex h-full flex-col">
                        <div className="min-w-0">
                            <Row
                                justifyContent="space-between"
                                alignItems="start"
                            >
                                <Typography level="body1" bold>
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
                                        className="min-w-0 flex-1 text-muted-foreground"
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
                                    className="mt-1 hidden rounded-lg border bg-muted/20 p-3 md:block"
                                >
                                    <Typography
                                        level="body3"
                                        bold
                                        uppercase
                                        className="mb-0.5 text-muted-foreground"
                                    >
                                        Sadržaj paketa
                                    </Typography>
                                    {breakdownRows}
                                    <div className="mt-1.5 flex items-baseline justify-between gap-3 border-t pt-1.5">
                                        <Typography
                                            level="body3"
                                            bold
                                            uppercase
                                            className="text-muted-foreground"
                                        >
                                            Ukupno
                                        </Typography>
                                        <Typography
                                            level="h4"
                                            className="whitespace-nowrap text-right tabular-nums"
                                        >
                                            {formatSunflowers(pkg.sunflowers)}{' '}
                                            🌻
                                        </Typography>
                                    </div>
                                </div>

                                <details
                                    data-package-breakdown="mobile"
                                    className="group mt-1 rounded-lg border bg-muted/20 md:hidden"
                                >
                                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 [&::-webkit-details-marker]:hidden">
                                        <span className="min-w-0">
                                            <Typography
                                                level="body3"
                                                bold
                                                uppercase
                                                className="text-muted-foreground"
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
                                                {formatSunflowers(
                                                    pkg.sunflowers,
                                                )}{' '}
                                                🌻
                                            </Typography>
                                            <ExpandDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
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
                                    className="text-muted-foreground"
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
                                loading={activeCheckoutCode === pkg.code}
                                onClick={() =>
                                    pkg.role === 'main'
                                        ? handleMainPackage(pkg)
                                        : startCheckout(pkg, 'direct')
                                }
                            >
                                Odaberi
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    const checkoutError =
        checkout.error instanceof SunflowerPackageCheckoutError
            ? checkout.error.reason
            : checkout.error
              ? 'checkout_failed'
              : null;

    return (
        <Stack spacing={4}>
            <Stack spacing={1}>
                <Typography level="h5">Paketi suncokreta</Typography>
                <Typography level="body3" className="text-muted-foreground">
                    Nadoplati Gredice saldo za sadnju, zalijevanje,
                    plijevljenje, fotografiranje, berbu i dostavu.
                </Typography>
            </Stack>

            {checkoutStatus === 'success' ? (
                <Alert color="success" startDecorator={<Check />}>
                    Plaćanje je zaprimljeno. Ako se saldo još nije promijenio,
                    pričekaj trenutak dok se uplata obradi.
                </Alert>
            ) : null}
            {checkoutStatus === 'cancel' ? (
                <Alert color="neutral">
                    Plaćanje je otkazano. Paket možeš ponovno odabrati kad
                    želiš.
                </Alert>
            ) : null}
            {checkoutError ? (
                <Alert color="warning">
                    {checkoutError === 'already_used'
                        ? 'Ova jednokratna ponuda je već iskorištena na tvom računu.'
                        : 'Paket trenutno nije moguće kupiti. Pokušaj ponovno za nekoliko trenutaka.'}
                </Alert>
            ) : null}
            {isError ? (
                <Alert color="warning">
                    Paketi se trenutno ne mogu učitati, ali saldo i aktivnosti
                    su i dalje dostupni.
                </Alert>
            ) : null}
            {isLoading ? (
                <Card className="min-h-32 animate-pulse bg-muted/40" />
            ) : null}

            {initialOffers.length > 0 || mainPackages.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    {initialOffers.map((pkg) => packageCard(pkg, true))}
                    {mainPackages.map((pkg) => packageCard(pkg))}
                </div>
            ) : null}

            {upsellPackage && upsellTriggerPackage ? (
                <Card className="border-primary/40 bg-primary/5">
                    <CardContent noHeader>
                        <Stack spacing={4}>
                            <Row spacing={3} alignItems="start">
                                <AI className="mt-1 size-5 shrink-0 text-primary" />
                                <Stack spacing={1}>
                                    <Typography level="body1" bold>
                                        Želiš veći saldo?
                                    </Typography>
                                    <Typography
                                        level="body3"
                                        className="text-muted-foreground"
                                    >
                                        Umjesto paketa{' '}
                                        {upsellTriggerPackage.name}
                                        možeš uzeti {upsellPackage.name} s
                                        ukupno{' '}
                                        {formatSunflowers(
                                            upsellPackage.sunflowers,
                                        )}{' '}
                                        suncokreta.
                                    </Typography>
                                </Stack>
                            </Row>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                <Button
                                    size="sm"
                                    loading={
                                        activeCheckoutCode ===
                                        upsellPackage.code
                                    }
                                    onClick={() =>
                                        startCheckout(
                                            upsellPackage,
                                            'upsell_accept',
                                        )
                                    }
                                >
                                    {upsellPackage.cta ?? 'Odaberi veći paket'}
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outlined"
                                    loading={
                                        activeCheckoutCode ===
                                        upsellTriggerPackage.code
                                    }
                                    onClick={() =>
                                        startCheckout(
                                            upsellTriggerPackage,
                                            'upsell_decline',
                                        )
                                    }
                                >
                                    Nastavi s {upsellTriggerPackage.name}
                                </Button>
                            </div>
                            <Button
                                size="sm"
                                variant="plain"
                                onClick={() => setUpsellTriggerCode(null)}
                            >
                                Vrati me na pakete
                            </Button>
                        </Stack>
                    </CardContent>
                </Card>
            ) : null}
        </Stack>
    );
}
