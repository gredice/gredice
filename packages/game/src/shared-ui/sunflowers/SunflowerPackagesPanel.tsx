'use client';

import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { Card, CardContent } from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import { useSearchParam } from '@gredice/ui/hooks';
import { AI, Check, Navigate } from '@gredice/ui/icons';
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

function packageBonusText(pkg: SunflowerPackageData) {
    if (pkg.bonusSunflowers <= 0) {
        return null;
    }
    return `+${formatSunflowers(pkg.bonusSunflowers)} bonus suncokreta`;
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

    useEffect(() => {
        if (!data || didTrackCatalogView.current) {
            return;
        }
        didTrackCatalogView.current = true;
        track('sunflower_package_catalog_viewed', {
            package_count: data.packages.length,
            initial_offer_count: data.groups.initialOffer.length,
            main_package_count: data.groups.main.length,
        });
    }, [data, track]);

    const packages = data?.packages ?? [];
    const initialOffers = useMemo(
        () => packagesByCodes(packages, data?.groups.initialOffer),
        [data?.groups.initialOffer, packages],
    );
    const mainPackages = useMemo(
        () => packagesByCodes(packages, data?.groups.main),
        [data?.groups.main, packages],
    );
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
        const bonusText = packageBonusText(pkg);
        return (
            <Card
                key={pkg.code}
                className={cx(
                    'min-h-52 border-tertiary/30',
                    featured && 'border-primary/40 bg-primary/5',
                )}
            >
                <CardContent noHeader>
                    <Stack spacing={3} className="h-full">
                        <Row justifyContent="space-between" alignItems="start">
                            <Stack spacing={1} className="min-w-0">
                                <Typography level="body1" bold>
                                    {pkg.name}
                                </Typography>
                                {pkg.tag ? (
                                    <Chip size="sm" variant="soft">
                                        {pkg.tag}
                                    </Chip>
                                ) : null}
                            </Stack>
                            <Typography
                                level="body2"
                                bold
                                className="tabular-nums"
                            >
                                {packagePrice(pkg)}
                            </Typography>
                        </Row>
                        <Stack spacing={1}>
                            <Typography level="h4" className="tabular-nums">
                                {formatSunflowers(pkg.sunflowers)} 🌻
                            </Typography>
                            {bonusText ? (
                                <Typography
                                    level="body3"
                                    className="text-primary"
                                >
                                    {bonusText}
                                </Typography>
                            ) : null}
                        </Stack>
                        {pkg.descriptionShort ? (
                            <Typography
                                level="body3"
                                className="min-h-10 text-muted-foreground"
                            >
                                {pkg.descriptionShort}
                            </Typography>
                        ) : null}
                        {pkg.ineligibleReason === 'already_used' ? (
                            <Typography
                                level="body3"
                                className="text-muted-foreground"
                            >
                                Ova ponuda je već iskorištena na tvom računu.
                            </Typography>
                        ) : null}
                        <Button
                            size="sm"
                            fullWidth
                            disabled={disabled}
                            loading={activeCheckoutCode === pkg.code}
                            endDecorator={<Navigate className="size-4" />}
                            onClick={() =>
                                pkg.role === 'main'
                                    ? handleMainPackage(pkg)
                                    : startCheckout(pkg, 'direct')
                            }
                        >
                            {pkg.cta ?? 'Kupi paket'}
                        </Button>
                    </Stack>
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

            {initialOffers.length > 0 ? (
                <Stack spacing={2}>
                    <Typography level="body2" bold>
                        Početna ponuda
                    </Typography>
                    <div className="grid grid-cols-1 gap-3">
                        {initialOffers.map((pkg) => packageCard(pkg, true))}
                    </div>
                </Stack>
            ) : null}

            {mainPackages.length > 0 ? (
                <Stack spacing={2}>
                    <Typography level="body2" bold>
                        Glavni paketi
                    </Typography>
                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                        {mainPackages.map((pkg) => packageCard(pkg))}
                    </div>
                </Stack>
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
