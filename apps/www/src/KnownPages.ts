import { PublicDirectoryPaths } from '@gredice/directory-types';
import type { Route } from 'next';
import {
    COMPANION_PLANTING_PATH,
    QUALITY_HARVEST_SAFETY_PATH,
} from './publicPagePaths';

// TODO: Deprecate KnownPages in favor of using route types directly
export const KnownPages = {
    Landing: '/',

    Delivery: '/dostava',
    DeliveryZagreb: '/dostava-povrca-zagreb',
    DeliverySlots: '/dostava/termini',
    Seeds: PublicDirectoryPaths.Seeds as Route,
    Seed: (alias: string) => PublicDirectoryPaths.Seed(alias) as Route,
    SeedBrands: PublicDirectoryPaths.SeedBrands as Route,
    SeedBrand: (alias: string) =>
        PublicDirectoryPaths.SeedBrand(alias) as Route,
    Plants: PublicDirectoryPaths.Plants as Route,
    Plant: (alias: string) => PublicDirectoryPaths.Plant(alias) as Route,
    PlantDiseases: PublicDirectoryPaths.PlantDiseases as Route,
    PlantDisease: (alias: string) =>
        PublicDirectoryPaths.PlantDisease(alias) as Route,
    PlantPests: PublicDirectoryPaths.PlantPests as Route,
    PlantPest: (alias: string) =>
        PublicDirectoryPaths.PlantPest(alias) as Route,
    PlantSort: (alias: string, sortName: string) =>
        PublicDirectoryPaths.PlantSort(alias, sortName) as Route,
    Blocks: PublicDirectoryPaths.Blocks as Route,
    Block: (alias: string) => PublicDirectoryPaths.Block(alias) as Route,
    BlockPlants: PublicDirectoryPaths.BlockPlants as Route,
    BlockPlant: (alias: string) =>
        PublicDirectoryPaths.BlockPlant(alias) as Route,
    BlockPets: PublicDirectoryPaths.BlockPets as Route,
    BlockPlantGenerator: '/blokovi/biljke/generator' as Route,
    Sunflowers: '/suncokreti',
    RaisedBeds: '/podignuta-gredica',
    Outlet: '/outlet',
    Sowing: '/sjetva',
    FirstRaisedBedGuide: '/vodic-za-prvu-gredicu',
    Operations: PublicDirectoryPaths.Operations as Route,
    Operation: (alias: string) =>
        PublicDirectoryPaths.Operation(alias) as Route,
    AboutUs: '/o-nama',
    MCP: '/mcp',
    FAQ: PublicDirectoryPaths.FAQ as Route,
    CompanionPlanting: COMPANION_PLANTING_PATH as Route,
    QualityHarvestSafety: QUALITY_HARVEST_SAFETY_PATH as Route,
    Contact: '/kontakt',
    Pricing: '/cjenik',
    Refunds: '/povrati-i-povrat-novca',
    Referrals: '/preporuke',
    News: '/novosti',
    WhatsNew: '/novosti/sto-je-novo',
    PublicGardens: '/vrtovi',
    Wallpapers: '/pozadine',
    PublicGarden: (gardenId: number) =>
        `/vrtovi/${gardenId.toString()}` as Route,

    LegalPrivacy: '/legalno/politika-privatnosti',
    LegalTerms: '/legalno/uvjeti-koristenja',
    LegalCookies: '/legalno/politika-kolacica',
    LegalLicense: '/legalno/licenca',
    LegalThirdParty: '/legalno/trece-strane',
    LegalCompany: '/legalno/tvrtka',
    LegalOccasions: PublicDirectoryPaths.LegalOccasions as Route,

    GardenApp: 'https://vrt.gredice.com',
    GardenReferrals: 'https://vrt.gredice.com/?pregled=preporuke',
    Status: 'https://status.gredice.com',
    GoogleMapsGrediceHQ: 'https://maps.app.goo.gl/hJbidDQzhHWGCZwS6',
} as const;
