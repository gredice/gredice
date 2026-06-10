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

export function useOutletOpenParam() {
    return useQueryState('outlet', parseAsString);
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
};

export function useRaisedBedCloseupParams() {
    return useQueryStates(raisedBedCloseupParamParsers);
}

// Raised bed field details parameter (Croatian: "polje" = field)
export function useRaisedBedFieldDetailsParam() {
    return useQueryState('polje', parseAsInteger);
}

// Gift box modal parameter (Croatian: "poklon-kutija" = gift box)
export function useGiftBoxParam() {
    return useQueryState('poklon-kutija', parseAsString);
}

// Current garden ID parameter (Croatian: "vrt" = garden)
export function useCurrentGardenIdParam() {
    return useQueryState('vrt', parseAsInteger);
}

// Serializer for building URLs with query params
export const urlStateSerializer = createSerializer({
    kosarica: parseAsBoolean,
    outlet: parseAsString,
    ruksak: parseAsBoolean,
    'ruksak-kartica': parseAsString,
    gredica: parseAsString,
    polje: parseAsInteger,
    'poklon-kutija': parseAsString,
    vrt: parseAsInteger,
});
