import {
    createSerializer,
    parseAsBoolean,
    parseAsString,
    useQueryState,
} from 'nuqs';

// Game mode parameter (Croatian: "uredivanje" = editing)
// true = edit mode, false/undefined = normal mode
export function useGameModeParam() {
    return useQueryState('uredivanje', parseAsBoolean.withDefault(false));
}

// Shopping cart modal parameter (Croatian: "kosarica" = cart)
export function useShoppingCartOpenParam() {
    return useQueryState('kosarica', parseAsBoolean.withDefault(false));
}

// Backpack/Inventory modal parameter (Croatian: "ruksak" = backpack)
export function useBackpackOpenParam() {
    return useQueryState('ruksak', parseAsBoolean.withDefault(false));
}

// Raised bed closeup parameter (Croatian: "gredica" = raised bed)
export function useRaisedBedCloseupParam() {
    return useQueryState('gredica', parseAsString);
}

// Serializer for building URLs with query params
export const urlStateSerializer = createSerializer({
    uredivanje: parseAsBoolean,
    kosarica: parseAsBoolean,
    ruksak: parseAsBoolean,
    gredica: parseAsString,
});
