import * as ReactQuery from '@tanstack/react-query';
import {
    AppRouterContext,
    type AppRouterInstance,
} from 'next/dist/shared/lib/app-router-context.shared-runtime';
import {
    PathnameContext,
    SearchParamsContext,
} from 'next/dist/shared/lib/hooks-client-context.shared-runtime';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { type PropsWithChildren, useMemo } from 'react';
import { GameAnalyticsProvider } from '../../../packages/game/src/analytics/GameAnalyticsContext';
import {
    type SunflowerPackageCatalog,
    sunflowerPackageKeys,
} from '../../../packages/game/src/hooks/useSunflowerPackages';
import { SunflowersHud } from '../../../packages/game/src/hud/SunflowersHud';
import { SunflowerPackagesPanel } from '../../../packages/game/src/shared-ui/sunflowers/SunflowerPackagesPanel';
import { SunflowersList } from '../../../packages/game/src/shared-ui/sunflowers/SunflowersList';

const sunflowerPackageCatalog = {
    packages: [
        {
            code: 'puna_gredica',
            name: 'Puna gredica',
            priceCents: 4999,
            priceEur: 49.99,
            currency: 'eur',
            sunflowers: 60000,
            baseSunflowers: 50000,
            bonusSunflowers: 10000,
            bonusPercentage: 20,
            tag: 'Jednokratna ponuda',
            descriptionShort: 'Početni paket za prvu veliku kupnju u vrtu.',
            descriptionLong: null,
            cta: 'Kupi početni paket',
            role: 'initial_one_time',
            eligible: true,
            ineligibleReason: null,
            displayOrder: 10,
            showInPrimaryList: false,
            isOneTime: true,
            upsellTriggerCode: null,
        },
        {
            code: 'mali_zalogaj',
            name: 'Mali zalogaj',
            priceCents: 499,
            priceEur: 4.99,
            currency: 'eur',
            sunflowers: 5000,
            baseSunflowers: 5000,
            bonusSunflowers: 0,
            bonusPercentage: 0,
            tag: null,
            descriptionShort: 'Mala nadoplata za brzu vrtnu akciju.',
            descriptionLong: null,
            cta: 'Kupi mali zalogaj',
            role: 'main',
            eligible: true,
            ineligibleReason: null,
            displayOrder: 20,
            showInPrimaryList: true,
            isOneTime: false,
            upsellTriggerCode: null,
        },
        {
            code: 'vrtna_kosarica',
            name: 'Vrtna košarica',
            priceCents: 3999,
            priceEur: 39.99,
            currency: 'eur',
            sunflowers: 42000,
            baseSunflowers: 40000,
            bonusSunflowers: 2000,
            bonusPercentage: 5,
            tag: 'Najpopularnije',
            descriptionShort: 'Najpraktičniji paket za redovite narudžbe.',
            descriptionLong: null,
            cta: 'Kupi vrtnu košaricu',
            role: 'main',
            eligible: true,
            ineligibleReason: null,
            displayOrder: 30,
            showInPrimaryList: true,
            isOneTime: false,
            upsellTriggerCode: null,
        },
        {
            code: 'mirna_sezona',
            name: 'Mirna sezona',
            priceCents: 9999,
            priceEur: 99.99,
            currency: 'eur',
            sunflowers: 110000,
            baseSunflowers: 100000,
            bonusSunflowers: 10000,
            bonusPercentage: 10,
            tag: 'Najbolja vrijednost',
            descriptionShort: 'Veći saldo za mirnu sezonu održavanja vrta.',
            descriptionLong: null,
            cta: 'Kupi mirnu sezonu',
            role: 'main',
            eligible: true,
            ineligibleReason: null,
            displayOrder: 40,
            showInPrimaryList: true,
            isOneTime: false,
            upsellTriggerCode: null,
        },
        {
            code: 'majstor_vrtlar',
            name: 'Majstor vrtlar',
            priceCents: 26999,
            priceEur: 269.99,
            currency: 'eur',
            sunflowers: 300000,
            baseSunflowers: 270000,
            bonusSunflowers: 30000,
            bonusPercentage: 11,
            tag: 'Master upsell',
            descriptionShort: 'Najveći paket za intenzivnu vrtnu sezonu.',
            descriptionLong: null,
            cta: 'Odaberi majstor paket',
            role: 'upsell',
            eligible: true,
            ineligibleReason: null,
            displayOrder: 50,
            showInPrimaryList: false,
            isOneTime: false,
            upsellTriggerCode: 'mirna_sezona',
        },
    ],
    groups: {
        initialOffer: ['puna_gredica'],
        main: ['mali_zalogaj', 'vrtna_kosarica', 'mirna_sezona'],
        upsell: ['majstor_vrtlar'],
    },
} satisfies SunflowerPackageCatalog;

const nextNavigationRouter = {
    back: () => undefined,
    forward: () => undefined,
    prefetch: () => undefined,
    push: () => undefined,
    refresh: () => undefined,
    replace: () => undefined,
} satisfies AppRouterInstance;

function createSunflowersHudQueryClient({
    accountSunflowers,
    cartSunflowers,
    history = [],
}: {
    accountSunflowers: number;
    cartSunflowers: number;
    history?: Array<{
        amount: number;
        createdAt: string;
        id: number;
        reason: string;
    }>;
}) {
    const queryClient = new ReactQuery.QueryClient({
        defaultOptions: {
            queries: { retry: false, staleTime: Infinity },
        },
    });

    queryClient.setQueryData(['currentUser'], { id: 'test-user' });
    queryClient.setQueryData(['accounts', 'current'], {
        id: 'test-account',
        name: 'Test Account',
        sunflowers: {
            amount: accountSunflowers,
            history,
        },
    });
    queryClient.setQueryData(['accounts', 'current', 'sunflowers', 'daily'], {
        current: { amount: 0, day: 1 },
        next: { amount: 1, day: 2 },
    });
    queryClient.setQueryData(['shopping-cart'], {
        allowPurchase: true,
        hasDeliverableItems: false,
        id: 1,
        items: [],
        notes: [],
        total: 0,
        totalSunflowers: cartSunflowers,
    });
    queryClient.setQueryData(sunflowerPackageKeys, sunflowerPackageCatalog);

    return queryClient;
}

function NextNavigationTestProvider({ children }: PropsWithChildren) {
    const searchParams = useMemo(() => new URLSearchParams(), []);

    return (
        <AppRouterContext.Provider value={nextNavigationRouter}>
            <PathnameContext.Provider value="/vrt">
                <SearchParamsContext.Provider value={searchParams}>
                    {children}
                </SearchParamsContext.Provider>
            </PathnameContext.Provider>
        </AppRouterContext.Provider>
    );
}

function SunflowersHudTestProviders({
    accountSunflowers,
    cartSunflowers,
    history,
    children,
}: PropsWithChildren<{
    accountSunflowers: number;
    cartSunflowers: number;
    history?: Array<{
        amount: number;
        createdAt: string;
        id: number;
        reason: string;
    }>;
}>) {
    const queryClient = useMemo(
        () =>
            createSunflowersHudQueryClient({
                accountSunflowers,
                cartSunflowers,
                history,
            }),
        [accountSunflowers, cartSunflowers, history],
    );

    return (
        <ReactQuery.QueryClientProvider client={queryClient}>
            {children}
        </ReactQuery.QueryClientProvider>
    );
}

export function SunflowersHudStory({
    accountSunflowers = 9034,
    cartSunflowers = 10470,
}: {
    accountSunflowers?: number;
    cartSunflowers?: number;
}) {
    return (
        <div className="min-h-96 p-12">
            <SunflowersHudTestProviders
                accountSunflowers={accountSunflowers}
                cartSunflowers={cartSunflowers}
            >
                <SunflowersHud />
            </SunflowersHudTestProviders>
        </div>
    );
}

export function SunflowersPendingDetailsStory({
    accountSunflowers = 9034,
    cartSunflowers = 10470,
    history,
}: {
    accountSunflowers?: number;
    cartSunflowers?: number;
    history?: Array<{
        amount: number;
        createdAt: string;
        id: number;
        reason: string;
    }>;
}) {
    return (
        <div className="w-80 p-4">
            <SunflowersHudTestProviders
                accountSunflowers={accountSunflowers}
                cartSunflowers={cartSunflowers}
                history={history}
            >
                <SunflowersList limit={5} pendingSunflowers={cartSunflowers} />
            </SunflowersHudTestProviders>
        </div>
    );
}

export function SunflowerPackagesPanelStory({
    initialOfferUsed = false,
}: {
    initialOfferUsed?: boolean;
}) {
    const queryClient = useMemo(() => {
        const client = createSunflowersHudQueryClient({
            accountSunflowers: 9034,
            cartSunflowers: 0,
        });
        client.setQueryData(sunflowerPackageKeys, {
            ...sunflowerPackageCatalog,
            packages: sunflowerPackageCatalog.packages.map((pkg) =>
                pkg.code === 'puna_gredica'
                    ? {
                          ...pkg,
                          eligible: !initialOfferUsed,
                          ineligibleReason: initialOfferUsed
                              ? 'already_used'
                              : null,
                      }
                    : pkg,
            ),
        } satisfies SunflowerPackageCatalog);
        return client;
    }, [initialOfferUsed]);

    return (
        <div className="max-w-4xl p-6">
            <NuqsTestingAdapter>
                <NextNavigationTestProvider>
                    <ReactQuery.QueryClientProvider client={queryClient}>
                        <GameAnalyticsProvider capture={() => undefined}>
                            <SunflowerPackagesPanel />
                        </GameAnalyticsProvider>
                    </ReactQuery.QueryClientProvider>
                </NextNavigationTestProvider>
            </NuqsTestingAdapter>
        </div>
    );
}
