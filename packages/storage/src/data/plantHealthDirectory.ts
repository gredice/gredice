import { plantHealthDirectoryDiseases } from './plantHealthDirectoryDiseases';
import { plantHealthDirectoryPests } from './plantHealthDirectoryPests';

/**
 * Published plant catalog snapshot used to author and statically validate the
 * plant-health dataset. The backfill still resolves every name against the
 * current published CMS catalog before writing.
 */
export const plantHealthDirectoryPlantNames = [
    'Artičoka',
    'Bamija',
    'Blitva',
    'Bob',
    'Bosiljak',
    'Brokula',
    'Celer',
    'Cikla',
    'Cvjetača',
    'Dinja',
    'Grah',
    'Grašak',
    'Jagoda',
    'Kadulja',
    'Kamilica',
    'Kelj',
    'Kelj pupčar',
    'Komorač',
    'Kopar',
    'Koraba',
    'Korijandar',
    'Krastavac',
    'Kupus',
    'Ljupčac',
    'Luk',
    'Luk vlasac',
    'Mahuna',
    'Matičnjak',
    'Matovilac',
    'Mrkva',
    'Origano',
    'Paprika',
    'Patlidžan',
    'Peršin',
    'Poriluk',
    'Rajčica',
    'Raštika',
    'Repa',
    'Rotkvica',
    'Rukola',
    'Salata',
    'Tikva',
    'Tikvice',
    'Timijan',
    'Češnjak',
    'Čili',
    'Špinat',
] as const;

export type PlantHealthDirectoryPlantName =
    (typeof plantHealthDirectoryPlantNames)[number];

// Source objects are serialized into multiple CMS values. Keep an existing
// label/URL pair stable unless the importer is also taught to reconcile it.
export const plantHealthDirectorySources = {
    umnTomatoLeafSpots: {
        label: 'University of Minnesota Extension tomato leaf spot diseases',
        url: 'https://extension.umn.edu/plant-diseases/tomato-leaf-spot-diseases',
    },
    umnEarlyBlightTomatoPotato: {
        label: 'University of Minnesota Extension early blight in tomato and potato',
        url: 'https://extension.umn.edu/node/2681',
    },
    umnLateBlight: {
        label: 'University of Minnesota Extension late blight',
        url: 'https://extension.umn.edu/disease-management/late-blight',
    },
    umnFusariumWilt: {
        label: 'University of Minnesota Extension Fusarium wilt',
        url: 'https://extension.umn.edu/disease-management/fusarium-wilt',
    },
    umnBacterialSpotTomatoPepper: {
        label: 'University of Minnesota Extension bacterial spot of tomato and pepper',
        url: 'https://extension.umn.edu/disease-management/bacterial-spot-tomato-and-pepper',
    },
    ucIpmPowderyMildewVegetables: {
        label: 'UC IPM Powdery Mildew on Vegetables',
        url: 'https://ipm.ucanr.edu/m/pn7406-0.html',
    },
    usuPowderyMildewVegetables: {
        label: 'Utah State University Extension powdery mildew of vegetables',
        url: 'https://extension.usu.edu/planthealth/research/powdery-mildew-vegetables',
    },
    umnDampingOff: {
        label: 'University of Minnesota Extension seedling damping off',
        url: 'https://extension.umn.edu/solve-problem/how-prevent-seedling-damping',
    },
    umnGrayMoldTomatoes: {
        label: 'University of Minnesota Extension gray mold in tomatoes',
        url: 'https://extension.umn.edu/disease-management/gray-mold-tomatoes',
    },
    umnWhiteMoldGarden: {
        label: 'University of Minnesota Extension white mold in gardens',
        url: 'https://extension.umn.edu/plant-diseases/white-mold-garden',
    },
    umnWhiteMoldCucurbits: {
        label: 'University of Minnesota Extension white mold of cucurbits',
        url: 'https://extension.umn.edu/disease-management/white-mold-cucurbits',
    },
    umnGrowingStrawberries: {
        label: 'University of Minnesota Extension growing strawberries in the home garden',
        url: 'https://extension.umn.edu/gardening-minnesota/growing-strawberries-home-garden',
    },
    umnDownyMildewCucurbits: {
        label: 'University of Minnesota Extension downy mildew of cucurbits',
        url: 'https://extension.umn.edu/disease-management/downy-mildew-cucurbits',
    },
    umnBlackRotBrassicas: {
        label: 'University of Minnesota Extension black rot of brassicas',
        url: 'https://extension.umn.edu/disease-management/organic-management-black-rot',
    },
    rhsBrassicaDownyMildew: {
        label: 'Royal Horticultural Society brassica downy mildew',
        url: 'https://www.rhs.org.uk/disease/brassica-downy-mildew',
    },
    umnClubroot: {
        label: 'University of Minnesota Extension clubroot',
        url: 'https://extension.umn.edu/plant-diseases/clubroot',
    },
    umnGrowingBeans: {
        label: 'University of Minnesota Extension growing beans',
        url: 'https://extension.umn.edu/vegetables/growing-beans',
    },
    usuPeas: {
        label: 'Utah State University Extension peas in the garden',
        url: 'https://extension.usu.edu/yardandgarden/research/peas-in-the-garden',
    },
    rhsBroadBeans: {
        label: 'Royal Horticultural Society growing broad beans',
        url: 'https://www.rhs.org.uk/vegetables/broad-beans/grow-your-own',
    },
    umnOnionDiagnosis: {
        label: 'University of Minnesota Extension onion disease diagnosis',
        url: 'https://apps.extension.umn.edu/garden/diagnose/plant/vegetable/onion/leaveswilt.html',
    },
    rhsOnionWhiteRot: {
        label: 'Royal Horticultural Society onion white rot',
        url: 'https://www.rhs.org.uk/disease/onion-white-rot',
    },
    rhsChives: {
        label: 'Royal Horticultural Society growing chives',
        url: 'https://www.rhs.org.uk/herbs/chives/grow-your-own',
    },
    umnBeetLeafSpots: {
        label: 'University of Minnesota Extension beet leaf spot diagnosis',
        url: 'https://apps.extension.umn.edu/garden/diagnose/plant/vegetable/beet/leavesspots.html',
    },
    umassCercosporaLeafSpot: {
        label: 'UMass Extension Cercospora leaf spot',
        url: 'https://www.umass.edu/agriculture-food-environment/node/8698',
    },
    umnCarrotLeafSpots: {
        label: 'University of Minnesota Extension carrot leaf spot diagnosis',
        url: 'https://apps.extension.umn.edu/garden/diagnose/plant/vegetable/carrot/leavesspots.html',
    },
    umnLettuceDiseases: {
        label: 'University of Minnesota Extension lettuce disease diagnosis',
        url: 'https://apps.extension.umn.edu/garden/diagnose/plant/vegetable/lettuce%26endive/fuzzygrowth.html',
    },
    umnAsterYellows: {
        label: 'University of Minnesota Extension aster yellows crop guidance',
        url: 'https://blog-fruit-vegetable-ipm.extension.umn.edu/2021/06/leafhopper-watch-hot-weather-and-aster.html',
    },
    umnBasilDownyMildew: {
        label: 'University of Minnesota Extension basil downy mildew',
        url: 'https://extension.umn.edu/disease-management/basil-downy-mildew',
    },
    ucIpmSpinachDownyMildew: {
        label: 'UC IPM downy mildew on spinach',
        url: 'https://ipm.ucanr.edu/home-and-landscape/downy-mildew-on-spinach/',
    },
    ucIpmCilantroParsleyBacterialLeafSpot: {
        label: 'UC IPM bacterial leaf spot of cilantro and parsley',
        url: 'https://ipm.ucanr.edu/agriculture/cilantro-and-parsley/bacterial-leaf-spot/',
    },
    eppoFusariumLettuce: {
        label: 'EPPO Fusarium wilt of lettuce',
        url: 'https://gd.eppo.int/taxon/FUSALC/hosts',
    },
    rhsHerbsContainers: {
        label: 'Royal Horticultural Society herbs in containers',
        url: 'https://www.rhs.org.uk/advice/profile?PID=142',
    },
    umnGrowingHerbs: {
        label: 'University of Minnesota Extension growing herbs',
        url: 'https://extension.umn.edu/gardening-minnesota/growing-herbs',
    },
    ucIpmRootStemCrownRots: {
        label: 'UC IPM root, stem and crown rots',
        url: 'https://ipm.ucanr.edu/home-and-landscape/root-stem-and-crown-rots/',
    },
    usuGrowingBasil: {
        label: 'Utah State University Extension growing basil',
        url: 'https://extension.usu.edu/yardandgarden/research/basil-in-the-garden',
    },
    usuOkra: {
        label: 'Utah State University Extension okra in the garden',
        url: 'https://extension.usu.edu/yardandgarden/research/okra-in-the-garden',
    },
    arkansasOkraWilt: {
        label: 'University of Arkansas Extension okra wilt',
        url: 'https://www.uaex.uada.edu/yard-garden/plant-health-clinic/disease-notes/posts/okra-wilt.aspx',
    },
    ucIpmArtichokeGrayMold: {
        label: 'UC IPM gray mold of artichoke',
        url: 'https://ipm.ucanr.edu/agriculture/artichoke/gray-mold-botrytis-fruit-rot/',
    },
    umnAphids: {
        label: 'University of Minnesota Extension aphids in home gardens',
        url: 'https://extension.umn.edu/yard-and-garden-insects/aphids',
    },
    ucIpmAphids: {
        label: 'UC IPM Aphids Pest Notes',
        url: 'https://ipm.ucanr.edu/home-and-landscape/aphids',
    },
    umnSlugs: {
        label: 'University of Minnesota Extension slugs in home gardens',
        url: 'https://extension.umn.edu/yard-and-garden-insects/slugs',
    },
    ucIpmWhiteflies: {
        label: 'UC IPM Whiteflies Pest Notes',
        url: 'https://ipm.ucanr.edu/home-and-landscape/whiteflies/pest-notes',
    },
    rhsCabbageWhitefly: {
        label: 'Royal Horticultural Society cabbage whitefly',
        url: 'https://www.rhs.org.uk/biodiversity/cabbage-whitefly',
    },
    umnSpiderMites: {
        label: 'University of Minnesota Extension spider mites',
        url: 'https://extension.umn.edu/yard-and-garden-insects/spider-mites',
    },
    usuSpiderMitesVegetables: {
        label: 'Utah State University Extension spider mites in vegetables',
        url: 'https://extension.usu.edu/planthealth/ipm/notes_ag/veg-spider-mites',
    },
    umnCutworms: {
        label: 'University of Minnesota Extension cutworms',
        url: 'https://extension.umn.edu/yard-and-garden-insects/cutworms',
    },
    umnLeafminers: {
        label: 'University of Minnesota Extension leafminers',
        url: 'https://extension.umn.edu/yard-and-garden-insects/leafminers',
    },
    umnFleaBeetles: {
        label: 'University of Minnesota Extension flea beetles',
        url: 'https://extension.umn.edu/yard-and-garden-insects/flea-beetles',
    },
    rhsCabbageCaterpillars: {
        label: 'Royal Horticultural Society cabbage caterpillars',
        url: 'https://www.rhs.org.uk/advice/profile?cID=446&pID=457',
    },
    rhsCabbageRootFly: {
        label: 'Royal Horticultural Society cabbage root fly',
        url: 'https://www.rhs.org.uk/biodiversity/cabbage-root-fly',
    },
    umnRootMaggots: {
        label: 'University of Minnesota Extension root maggots',
        url: 'https://extension.umn.edu/yard-and-garden-insects/root-maggots',
    },
    rhsOnionFly: {
        label: 'Royal Horticultural Society onion fly',
        url: 'https://www.rhs.org.uk/biodiversity/onion-fly',
    },
    usuOnionThrips: {
        label: 'Utah State University Extension onion thrips',
        url: 'https://extension.usu.edu/planthealth/research/onion-thrips',
    },
    rhsAlliumLeafMiner: {
        label: 'Royal Horticultural Society allium leaf miner',
        url: 'https://www.rhs.org.uk/biodiversity/allium-leaf-miner',
    },
    rhsCarrotFly: {
        label: 'Royal Horticultural Society carrot fly',
        url: 'https://www.rhs.org.uk/biodiversity/carrot-fly',
    },
    usuVegetablePestGuide: {
        label: 'Utah State University vegetable pest identification guide',
        url: 'https://extension.usu.edu/pests/files/pubs/Vegetable-Pest-of-Utah-ID-Guide.pdf',
    },
    rhsBeetLeafMiner: {
        label: 'Royal Horticultural Society beet leaf miner',
        url: 'https://www.rhs.org.uk/biodiversity/beet-leaf-miner',
    },
    rhsPeaBeanWeevils: {
        label: 'Royal Horticultural Society pea and bean weevils',
        url: 'https://www.rhs.org.uk/biodiversity/pea-and-bean-weevils',
    },
    rhsPeaMoth: {
        label: 'Royal Horticultural Society pea moth',
        url: 'https://www.rhs.org.uk/advice/profile?lang=en&pid=660',
    },
    umnColoradoPotatoBeetle: {
        label: 'University of Minnesota Extension Colorado potato beetle',
        url: 'https://extension.umn.edu/yard-and-garden-insects/colorado-potato-beetle',
    },
    eppoTomatoLeafMinerCroatia: {
        label: 'EPPO first report of tomato leaf miner in Croatia',
        url: 'https://gd.eppo.int/reporting/article-1805',
    },
    eppoTomatoLeafMinerHosts: {
        label: 'EPPO tomato leaf miner host plants',
        url: 'https://gd.eppo.int/taxon/GNORAB/hosts',
    },
    eppoCottonBollworm: {
        label: 'EPPO cotton bollworm datasheet',
        url: 'https://gd.eppo.int/taxon/HELIAR/datasheet',
    },
    rhsRosemaryBeetle: {
        label: 'Royal Horticultural Society rosemary beetle',
        url: 'https://www.rhs.org.uk/biodiversity/rosemary-beetle',
    },
    rhsSageLigurianLeafhoppers: {
        label: 'Royal Horticultural Society sage and Ligurian leafhoppers',
        url: 'https://www.rhs.org.uk/biodiversity/sage-and-ligurian-leafhoppers',
    },
    usuRootKnotNematodes: {
        label: 'Utah State University Extension root-knot nematodes',
        url: 'https://extension.usu.edu/vegetableguide/tomato-pepper-eggplant/root-knot-nematodes',
    },
} as const;

export type PlantHealthDirectorySource =
    keyof typeof plantHealthDirectorySources;

export type PlantHealthDirectoryIssueKind = 'disease' | 'pest';

export type PlantHealthDirectoryIssue = {
    kind: PlantHealthDirectoryIssueKind;
    name: string;
    legacyNames?: readonly string[];
    label?: string;
    shortDescription: string;
    description: string;
    symptoms: string;
    favorableConditions: string;
    severity: string;
    affectedPlants: readonly PlantHealthDirectoryPlantName[];
    operations?: {
        prevention?: readonly string[];
        reduction?: readonly string[];
        alleviation?: readonly string[];
    };
    reconcileAffectedPlants?: boolean;
    reconcileOperations?: boolean;
    reconcileSources?: boolean;
    sources: readonly PlantHealthDirectorySource[];
    reviewNotes?: readonly string[];
};

export const plantHealthDirectoryDataset: readonly PlantHealthDirectoryIssue[] =
    [...plantHealthDirectoryDiseases, ...plantHealthDirectoryPests];
