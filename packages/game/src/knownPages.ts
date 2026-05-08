import { slugify } from '@gredice/js/slug';

export const KnownPages = {
    GredicePlants: 'https://www.gredice.com/biljke',
    GredicePlant: (alias: string) =>
        `https://www.gredice.com/biljke/${slugify(alias)}`,
    GredicePlantSort: (alias: string, sortAlias: string) =>
        `https://www.gredice.com/biljke/${slugify(alias)}/sorte/${slugify(sortAlias)}`,
    GrediceOperations: 'https://www.gredice.com/radnje',
    GrediceOperation: (alias: string) =>
        `https://www.gredice.com/radnje/${slugify(alias)}`,
    GrediceBlocks: 'https://www.gredice.com/blokovi',
    GrediceBlock: (alias: string) =>
        `https://www.gredice.com/blokovi/${slugify(alias)}`,
    GrediceSunflowers: 'https://www.gredice.com/suncokreti',
    GrediceContact: 'https://www.gredice.com/kontakt',
    GrediceDeliverySlots: 'https://www.gredice.com/dostava/termini',
    AdventRules2025:
        'https://www.gredice.com/legalno/natjecaji/adventski-kalendar-2025',

    GoogleMapsGrediceHQ: 'https://maps.app.goo.gl/hJbidDQzhHWGCZwS6',
};
