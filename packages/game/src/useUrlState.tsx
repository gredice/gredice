import {
    createSerializer,
    parseAsBoolean,
    parseAsInteger,
    parseAsString,
    useQueryState,
    useQueryStates,
} from 'nuqs';

// Shopping cart modal parameter (Croatian: "kosarica" = cart)
export function useShoppingCartOpenParam() {
    return useQueryState('kosarica', parseAsBoolean.withDefault(false));
}

export function usePaymentStatusParam() {
    return useQueryState('placanje', parseAsString);
}

export function useOutletOpenParam() {
    return useQueryState('outlet', parseAsString);
}

export function useOutletOfferSelectionParam() {
    return useQueryState('outlet-ponuda', parseAsInteger);
}

// Backpack/Inventory modal parameter (Croatian: "ruksak" = backpack)
export function useBackpackOpenParam() {
    return useQueryState('ruksak', parseAsBoolean.withDefault(false));
}

export const backpackInventoryTab = 'backpack';
export const gardenBoxesInventoryTab = 'gardenBoxes';
const backpackInventoryParamParsers = {
    ruksak: parseAsBoolean.withDefault(false),
    'ruksak-kartica': parseAsString.withDefault(backpackInventoryTab),
};

// Backpack/Inventory tab parameter (Croatian: "ruksak-kartica" = backpack tab)
export function useBackpackTabParam() {
    return useQueryState(
        'ruksak-kartica',
        parseAsString.withDefault(backpackInventoryTab),
    );
}

export function normalizeBackpackTab(value: string | null | undefined) {
    return value === gardenBoxesInventoryTab
        ? gardenBoxesInventoryTab
        : backpackInventoryTab;
}

export function useBackpackInventoryParams() {
    return useQueryStates(backpackInventoryParamParsers);
}

// Raised bed closeup parameter (Croatian: "gredica" = raised bed)
export function useRaisedBedCloseupParam() {
    return useQueryState('gredica', parseAsString);
}

const raisedBedCloseupParamParsers = {
    gredica: parseAsString,
    polje: parseAsInteger,
    'polje-kartica': parseAsString,
};

export function useRaisedBedCloseupParams() {
    return useQueryStates(raisedBedCloseupParamParsers);
}

// Raised bed field details parameter (Croatian: "polje" = field)
export function useRaisedBedFieldDetailsParam() {
    return useQueryState('polje', parseAsInteger);
}

export const raisedBedFieldTabValues = [
    'lifecycle',
    'diary',
    'operations',
] as const;
export type RaisedBedFieldTabValue = (typeof raisedBedFieldTabValues)[number];

export function normalizeRaisedBedFieldTab(
    value: string | null | undefined,
): RaisedBedFieldTabValue {
    return raisedBedFieldTabValues.find((tab) => tab === value) ?? 'lifecycle';
}

// Gift box modal parameter (Croatian: "poklon-kutija" = gift box)
export function useGiftBoxParam() {
    return useQueryState('poklon-kutija', parseAsString);
}

// Editable wooden sign parameter (Croatian: "natpis" = inscription)
export function useWoodenSignParam() {
    return useQueryState('natpis', parseAsString);
}

// Current garden ID parameter (Croatian: "vrt" = garden)
export function useCurrentGardenIdParam() {
    return useQueryState('vrt', parseAsInteger);
}

export function useOverviewSectionParam() {
    return useQueryState('pregled', parseAsString);
}

// Serializer for building URLs with query params
export const urlStateSerializer = createSerializer({
    kosarica: parseAsBoolean,
    placanje: parseAsString,
    outlet: parseAsString,
    'outlet-ponuda': parseAsInteger,
    ruksak: parseAsBoolean,
    'ruksak-kartica': parseAsString,
    gredica: parseAsString,
    polje: parseAsInteger,
    'polje-kartica': parseAsString,
    'poklon-kutija': parseAsString,
    natpis: parseAsString,
    vrt: parseAsInteger,
    pregled: parseAsString,
});
