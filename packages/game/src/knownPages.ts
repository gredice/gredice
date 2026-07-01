import { slugify } from '@gredice/js/slug';

export const KnownPages = {
    GredicePlants: 'https://www.gredice.com/biljke',
    GredicePlant: (alias: string) =>
        `https://www.gredice.com/biljke/${slugify(alias)}`,
    GredicePlantSort: (alias: string, sortAlias: string) =>
        `https://www.gredice.com/biljke/${slugify(alias)}/sorte/${slugify(sortAlias)}`,
    GrediceCompanionPlanting: 'https://www.gredice.com/biljni-susjedi',
    GrediceOperations: 'https://www.gredice.com/radnje',
    GrediceOperation: (alias: string) =>
        `https://www.gredice.com/radnje/${slugify(alias)}`,
    GrediceBlocks: 'https://www.gredice.com/blokovi',
    GrediceBlock: (alias: string) =>
        `https://www.gredice.com/blokovi/${slugify(alias)}`,
    GrediceSunflowers: 'https://www.gredice.com/suncokreti',
    GrediceReferrals: 'https://www.gredice.com/preporuke',
    GrediceContact: 'https://www.gredice.com/kontakt',
    GredicePublicGarden: (gardenId: number) =>
        `https://www.gredice.com/vrtovi/${gardenId.toString()}`,
    GrediceFirstRaisedBedGuide: 'https://www.gredice.com/vodic-za-prvu-gredicu',
    GrediceWhatsNew: 'https://www.gredice.com/novosti/sto-je-novo',
    GrediceDeliverySlots: 'https://www.gredice.com/dostava/termini',
    GrediceHarvestTrace: (publicPath: string) =>
        publicPath.startsWith('http')
            ? publicPath
            : `https://www.gredice.com/${publicPath.replace(/^\/+/, '')}`,
    AdventRules2025:
        'https://www.gredice.com/legalno/natjecaji/adventski-kalendar-2025',

    GoogleMapsGrediceHQ: 'https://maps.app.goo.gl/hJbidDQzhHWGCZwS6',
};
