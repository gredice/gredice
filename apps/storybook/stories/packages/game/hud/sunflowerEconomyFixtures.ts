import type { SunflowerPackageData } from '@packages/game/hooks/useSunflowerPackages';

const packageExamples: Pick<
    SunflowerPackageData,
    | 'code'
    | 'name'
    | 'priceCents'
    | 'sunflowers'
    | 'baseSunflowers'
    | 'tag'
    | 'descriptionShort'
    | 'role'
>[] = [
    {
        code: 'mali_zalogaj',
        name: 'Mali zalogaj',
        priceCents: 499,
        sunflowers: 5000,
        baseSunflowers: 5000,
        tag: null,
        descriptionShort: 'Mala nadoplata za brzu vrtnu akciju.',
        role: 'main',
    },
    {
        code: 'vrtna_kosarica',
        name: 'Vrtna košarica',
        priceCents: 3999,
        sunflowers: 42000,
        baseSunflowers: 40000,
        tag: 'Najpopularnije',
        descriptionShort: 'Najpraktičniji paket za redovite vrtne narudžbe.',
        role: 'main',
    },
    {
        code: 'mirna_sezona',
        name: 'Mirna sezona',
        priceCents: 9999,
        sunflowers: 110000,
        baseSunflowers: 100000,
        tag: 'Najbolja vrijednost',
        descriptionShort: 'Veći saldo za mirnu sezonu održavanja vrta.',
        role: 'main',
    },
    {
        code: 'puna_gredica',
        name: 'Puna gredica',
        priceCents: 4999,
        sunflowers: 60000,
        baseSunflowers: 50000,
        tag: 'Jednokratna ponuda',
        descriptionShort: 'Početni paket za prvu veliku kupnju u vrtu.',
        role: 'initial_one_time',
    },
    {
        code: 'majstor_vrtlar',
        name: 'Majstor vrtlar',
        priceCents: 26999,
        sunflowers: 300000,
        baseSunflowers: 270000,
        tag: null,
        descriptionShort: 'Najveći paket za intenzivnu vrtnu sezonu.',
        role: 'upsell',
    },
];

export const sunflowerVisualPackages: SunflowerPackageData[] =
    packageExamples.map((pkg, index) => ({
        ...pkg,
        priceEur: pkg.priceCents / 100,
        currency: 'eur',
        bonusSunflowers: pkg.sunflowers - pkg.baseSunflowers,
        bonusPercentage: Math.round(
            (pkg.sunflowers / pkg.baseSunflowers - 1) * 100,
        ),
        descriptionLong: null,
        cta: 'Odaberi',
        eligible: true,
        ineligibleReason: null,
        displayOrder: index,
        showInPrimaryList: pkg.role === 'main',
        isOneTime: pkg.role === 'initial_one_time',
        upsellTriggerCode: pkg.role === 'upsell' ? 'mirna_sezona' : null,
    }));

export const sunflowerVisualHistory = [
    { reason: 'shoppingCart:1', amount: -3000 },
    { reason: 'shoppingCart:2', amount: -3000 },
    { reason: 'daily:7', amount: 50 },
    { reason: 'gift', amount: 100 },
    { reason: 'payment', amount: 5000 },
    { reason: 'sunflowerPackage:vrtna_kosarica:1', amount: 42000 },
    { reason: 'refund:operation:1', amount: 200 },
    { reason: 'referral:1', amount: 500 },
    { reason: 'birthday:2026', amount: 1000 },
    { reason: 'tutorial:open-cart', amount: 25 },
    { reason: 'sunflowerDrop', amount: 1 },
    { reason: 'gardenStructure:1:2:create:3:debit', amount: -500 },
    { reason: 'gardenStructure:1:2:resize:3:debit', amount: -200 },
    { reason: 'gardenStructure:1:2:delete:3:refund', amount: 500 },
    { reason: 'registration', amount: 100 },
].map((event, index) => ({
    ...event,
    id: index + 1,
    createdAt: '2026-09-17T08:00:00.000Z',
}));
