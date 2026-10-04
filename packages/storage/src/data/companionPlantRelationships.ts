const brassicas = [
    'Brokula',
    'Cvjetača',
    'Kupus',
    'Kelj',
    'Kelj pupčar',
    'Koraba',
    'Raštika',
    'Repa',
];

const beans = ['Grah', 'Mahuna'];
const alliums = ['Luk', 'Češnjak', 'Poriluk', 'Luk vlasac'];

export const companionPlantRelationshipSources = {
    ufIfasManatee: {
        label: 'UF/IFAS Manatee County Extension companion planting chart',
        url: 'https://www.growables.org/informationVeg/documents/CompanionGuideUF.pdf',
    },
    virginiaCooperativeExtension: {
        label: 'Virginia Cooperative Extension SPES-620P companion planting chart',
        url: 'https://www.pubs.ext.vt.edu/content/dam/pubs_ext_vt_edu/spes/spes-620/SPES-620.pdf',
    },
    wvuExtension: {
        label: 'West Virginia University Extension companion planting guidance',
        url: 'https://extension.wvu.edu/lawn-gardening-pests/gardening/garden-management/companion-planting',
    },
    umnExtension: {
        label: 'University of Minnesota Extension companion planting context',
        url: 'https://extension.umn.edu/planting-and-growing-guides/companion-planting-home-gardens',
    },
} as const;

export type CompanionPlantRelationshipSource =
    keyof typeof companionPlantRelationshipSources;

export type CompanionPlantRelationshipEntry = {
    plant: string;
    companions?: string[];
    antagonists?: string[];
    sources: CompanionPlantRelationshipSource[];
    notes?: string[];
};

const primaryChartSources: CompanionPlantRelationshipSource[] = [
    'ufIfasManatee',
    'virginiaCooperativeExtension',
];

export const companionPlantRelationshipCaveatSources: CompanionPlantRelationshipSource[] =
    ['wvuExtension', 'umnExtension'];

export const companionPlantRelationshipDataset: CompanionPlantRelationshipEntry[] =
    [
        {
            plant: 'Rajčica',
            companions: [
                'Bosiljak',
                'Mrkva',
                'Celer',
                'Češnjak',
                'Luk',
                'Luk vlasac',
                'Salata',
                'Peršin',
                'Paprika',
                'Čili',
                'Krastavac',
            ],
            antagonists: ['Komorač', 'Kopar'],
            sources: primaryChartSources,
            notes: [
                'Skipped tomato and cabbage-family pairs because available charts conflict.',
            ],
        },
        {
            plant: 'Bosiljak',
            companions: ['Rajčica', 'Paprika', 'Čili'],
            antagonists: beans,
            sources: ['ufIfasManatee'],
        },
        {
            plant: 'Paprika',
            companions: ['Bosiljak', 'Rajčica', 'Luk'],
            sources: ['ufIfasManatee'],
        },
        {
            plant: 'Čili',
            companions: ['Bosiljak', 'Rajčica', 'Luk'],
            sources: ['ufIfasManatee'],
        },
        {
            plant: 'Mrkva',
            companions: [
                ...beans,
                'Grašak',
                'Salata',
                ...alliums,
                'Rajčica',
                ...brassicas,
            ],
            antagonists: ['Kopar', 'Celer', 'Peršin'],
            sources: primaryChartSources,
            notes: [
                'Skipped carrot and radish because available charts conflict.',
            ],
        },
        {
            plant: 'Grah',
            companions: [
                'Mrkva',
                'Krastavac',
                'Patlidžan',
                'Salata',
                'Rotkvica',
                'Jagoda',
                'Špinat',
                'Celer',
                'Cikla',
                'Grašak',
            ],
            antagonists: [...alliums, 'Komorač', 'Bosiljak'],
            sources: primaryChartSources,
            notes: [
                'Generic Gredice bean entities are mapped conservatively; ambiguous pole-bean-only conflicts are skipped.',
            ],
        },
        {
            plant: 'Mahuna',
            companions: [
                'Mrkva',
                'Krastavac',
                'Patlidžan',
                'Salata',
                'Rotkvica',
                'Jagoda',
                'Špinat',
                'Celer',
                'Cikla',
                'Grašak',
            ],
            antagonists: [...alliums, 'Komorač', 'Bosiljak'],
            sources: primaryChartSources,
            notes: [
                'Generic Gredice bean entities are mapped conservatively; ambiguous pole-bean-only conflicts are skipped.',
            ],
        },
        {
            plant: 'Grašak',
            companions: [
                ...beans,
                'Mrkva',
                'Celer',
                'Krastavac',
                'Patlidžan',
                'Peršin',
                'Rotkvica',
                'Špinat',
                'Jagoda',
                'Repa',
            ],
            antagonists: alliums,
            sources: primaryChartSources,
        },
        {
            plant: 'Luk',
            companions: [
                'Cikla',
                ...brassicas,
                'Mrkva',
                'Celer',
                'Krastavac',
                'Paprika',
                'Čili',
                'Špinat',
                'Tikva',
                'Tikvice',
                'Jagoda',
                'Rajčica',
                'Repa',
            ],
            antagonists: [...beans, 'Grašak', 'Kadulja'],
            sources: primaryChartSources,
            notes: [
                'Skipped lettuce and onion-family pairs because available charts conflict.',
            ],
        },
        {
            plant: 'Češnjak',
            companions: ['Mrkva', 'Rajčica', ...brassicas],
            antagonists: [...beans, 'Grašak'],
            sources: primaryChartSources,
        },
        {
            plant: 'Poriluk',
            companions: ['Mrkva', ...brassicas],
            antagonists: [...beans, 'Grašak'],
            sources: ['virginiaCooperativeExtension'],
        },
        {
            plant: 'Luk vlasac',
            companions: ['Mrkva', 'Rajčica'],
            antagonists: [...beans, 'Grašak'],
            sources: primaryChartSources,
        },
        {
            plant: 'Cikla',
            companions: [
                ...beans,
                ...brassicas,
                'Salata',
                'Luk',
                'Rotkvica',
                'Kadulja',
            ],
            sources: ['ufIfasManatee'],
        },
        ...brassicas.map(
            (plant): CompanionPlantRelationshipEntry => ({
                plant,
                companions: [
                    'Cikla',
                    'Mrkva',
                    'Celer',
                    ...alliums,
                    'Kamilica',
                    'Kadulja',
                    'Timijan',
                    'Salata',
                    'Špinat',
                    'Blitva',
                    'Krastavac',
                ],
                antagonists: ['Jagoda'],
                sources: primaryChartSources,
                notes: [
                    'Skipped tomato, dill, and generic bean pairs for cabbage-family plants where source charts conflict or only mention pole beans.',
                ],
            }),
        ),
        {
            plant: 'Kopar',
            antagonists: ['Mrkva', 'Rajčica'],
            sources: primaryChartSources,
        },
        {
            plant: 'Kadulja',
            companions: [...brassicas, 'Cikla', 'Mrkva'],
            antagonists: ['Luk'],
            sources: ['ufIfasManatee'],
        },
        {
            plant: 'Kamilica',
            companions: [...brassicas, 'Luk'],
            sources: ['ufIfasManatee'],
        },
        {
            plant: 'Timijan',
            companions: brassicas,
            sources: ['ufIfasManatee'],
        },
        {
            plant: 'Krastavac',
            companions: [
                ...beans,
                'Grašak',
                'Rotkvica',
                'Salata',
                'Rajčica',
                'Luk',
            ],
            sources: primaryChartSources,
            notes: [
                'Skipped cucumber and strong-herb pairs because available charts are broad and conflict.',
            ],
        },
        {
            plant: 'Patlidžan',
            companions: [...beans, 'Grašak', 'Paprika', 'Čili', 'Špinat'],
            antagonists: ['Komorač'],
            sources: primaryChartSources,
        },
        {
            plant: 'Salata',
            companions: ['Mrkva', 'Rotkvica', 'Krastavac', 'Jagoda', ...beans],
            antagonists: ['Peršin'],
            sources: primaryChartSources,
            notes: [
                'Skipped lettuce and onion-family pairs because available charts conflict.',
            ],
        },
        {
            plant: 'Rotkvica',
            companions: [
                'Cikla',
                ...beans,
                'Krastavac',
                'Salata',
                'Dinja',
                'Grašak',
                'Špinat',
                'Tikva',
                'Tikvice',
                'Jagoda',
            ],
            sources: primaryChartSources,
            notes: [
                'Skipped carrot and radish because available charts conflict.',
            ],
        },
        {
            plant: 'Špinat',
            companions: ['Celer', 'Patlidžan', 'Jagoda', ...beans, 'Luk'],
            sources: primaryChartSources,
            notes: [
                'Skipped spinach and cabbage-family pairs because available charts conflict.',
            ],
        },
        {
            plant: 'Jagoda',
            companions: [...beans, 'Salata', 'Luk', 'Rotkvica', 'Špinat'],
            antagonists: brassicas,
            sources: primaryChartSources,
        },
        {
            plant: 'Tikva',
            companions: ['Luk', 'Rotkvica'],
            sources: primaryChartSources,
        },
        {
            plant: 'Tikvice',
            companions: ['Luk', 'Rotkvica'],
            sources: primaryChartSources,
        },
        {
            plant: 'Dinja',
            companions: ['Rotkvica'],
            sources: ['ufIfasManatee'],
        },
        {
            plant: 'Peršin',
            companions: ['Rajčica', 'Grašak'],
            antagonists: ['Mrkva', 'Salata'],
            sources: primaryChartSources,
        },
        {
            plant: 'Komorač',
            antagonists: ['Rajčica', 'Patlidžan', ...beans],
            sources: primaryChartSources,
            notes: [
                'Kept only specific in-repo plant matches instead of applying the broad "most plants dislike fennel" note.',
            ],
        },
    ];
