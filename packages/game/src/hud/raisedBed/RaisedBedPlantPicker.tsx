import type { PlantData, PlantSortData } from '@gredice/client';
import {
    ADVANCED_SOWING_DEFAULT_BED_FIELD_COUNT,
    buildAdvancedSowingSelectionRequestV1,
} from '@gredice/js/plants';
import { Button } from '@gredice/ui/Button';
import {
    CalendarDatePicker,
    parseCalendarDateKey,
} from '@gredice/ui/CalendarDatePicker';
import { IconButton } from '@gredice/ui/IconButton';
import { Input } from '@gredice/ui/Input';
import {
    Calendar,
    Check,
    Close,
    Discount,
    Left,
    Search,
    ShoppingCart,
    Sprout,
} from '@gredice/ui/icons';
import { PlantingSeedIcon } from '@gredice/ui/PlantingSeedIcon';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Switch } from '@gredice/ui/Switch';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import {
    type ChangeEvent,
    type ReactElement,
    useId,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { useGameAnalytics } from '../../analytics/GameAnalyticsContext';
import { SegmentedProgress } from '../../controls/components/SegmentedProgress';
import { useGameFlags } from '../../GameFlagsContext';
import { buildOutletCartItemPayload } from '../../hooks/shoppingCartItemMutation';
import { useCurrentGarden } from '../../hooks/useCurrentGarden';
import { useGardens } from '../../hooks/useGardens';
import { useInventory } from '../../hooks/useInventory';
import {
    type OutletOfferData,
    useOutletOffers,
} from '../../hooks/useOutletOffers';
import { useAllSorts } from '../../hooks/usePlantSorts';
import { useSandboxPlant } from '../../hooks/useSandboxPlant';
import { useSetShoppingCartItem } from '../../hooks/useSetShoppingCartItem';
import {
    type ShoppingCartItemData,
    useShoppingCart,
} from '../../hooks/useShoppingCart';
import {
    scheduleHideShoppingCartTransientHub,
    showShoppingCartTransientHub,
} from '../../hooks/useShoppingCartTransientHub';
import { KnownPages } from '../../knownPages';
import { GameModal } from '../../shared-ui/game-modal';
import { useOutletOfferSelectionParam } from '../../useUrlState';
import { AdvancedSowingPickerPreview } from './AdvancedSowingPickerPreview';
import {
    createAdvancedSowingPickerPreview,
    getSelectedAdvancedSowingPickerOption,
} from './advancedSowingPicker';
import {
    findAdvancedSowingCartItem,
    getAdvancedSowingPlanAvailability,
    getLegacySowingTargetAvailability,
    readAdvancedSowingCartItemSelectionSummary,
} from './advancedSowingSubmission';
import { isGreenhouseSowingRecommended } from './greenhouseSowingRecommendation';
import { PlantsList } from './PlantsList';
import { PlantsSortList } from './PlantsSortList';
import {
    getNeighborPlantSummaries,
    getRaisedBedRelationshipBlockCount,
} from './plantRelationshipSignals';

// Sandbox ("play") gardens let you pick how grown the plant should look. Each
// preset backdates the sow date so the existing generation rendering draws a
// plant at the chosen maturity.
const SANDBOX_AGE_PRESETS = [
    { label: 'Mlada', ageDays: 14, status: 'sprouted' },
    { label: 'Srednja', ageDays: 40, status: 'sprouted' },
    { label: 'Zrela', ageDays: 80, status: 'ready' },
] as const;

// Helper to format date as YYYY-MM-DD in local time
// TODO: Move to shared utilities
export function formatLocalDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

const outletCurrencyFormatter = new Intl.NumberFormat('hr-HR', {
    style: 'currency',
    currency: 'EUR',
});

const outletDateFormatter = new Intl.DateTimeFormat('hr-HR', {
    day: 'numeric',
    month: 'short',
});

function outletOfferTimestamp(date: string) {
    const timestamp = new Date(date).getTime();
    return Number.isNaN(timestamp) ? Number.POSITIVE_INFINITY : timestamp;
}

function compareOutletOffers(left: OutletOfferData, right: OutletOfferData) {
    const sowingDateDifference =
        outletOfferTimestamp(left.sowingDate) -
        outletOfferTimestamp(right.sowingDate);
    if (sowingDateDifference !== 0) {
        return sowingDateDifference;
    }

    const priceDifference = left.outletPrice - right.outletPrice;
    if (priceDifference !== 0) {
        return priceDifference;
    }

    return left.id - right.id;
}

function groupOutletOffersBySortId(outletOffers: OutletOfferData[] = []) {
    const offersBySortId = new Map<number, OutletOfferData[]>();

    for (const offer of outletOffers) {
        const sortOffers = offersBySortId.get(offer.plantSort.id);
        if (sortOffers) {
            sortOffers.push(offer);
        } else {
            offersBySortId.set(offer.plantSort.id, [offer]);
        }
    }

    for (const sortOffers of offersBySortId.values()) {
        sortOffers.sort(compareOutletOffers);
    }

    return offersBySortId;
}

function groupOutletOffersByPlantId(
    outletOffers: OutletOfferData[] | undefined,
    allSorts: PlantSortData[] | undefined,
) {
    const offersByPlantId = new Map<number, OutletOfferData[]>();

    for (const offer of outletOffers ?? []) {
        const plantId = outletOfferPlantId(offer, allSorts);
        if (!plantId) {
            continue;
        }

        const plantOffers = offersByPlantId.get(plantId);
        if (plantOffers) {
            plantOffers.push(offer);
        } else {
            offersByPlantId.set(plantId, [offer]);
        }
    }

    for (const plantOffers of offersByPlantId.values()) {
        plantOffers.sort(compareOutletOffers);
    }

    return offersByPlantId;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseAdditionalData(additionalData?: string | null) {
    if (!additionalData) {
        return {};
    }

    try {
        const parsed: unknown = JSON.parse(additionalData);
        return isRecord(parsed) ? parsed : {};
    } catch {
        return {};
    }
}

function isGreenhouseSowing(additionalData?: string | null) {
    return parseAdditionalData(additionalData).sowingLocation === 'greenhouse';
}

function outletOfferPlantId(
    offer: OutletOfferData,
    allSorts: PlantSortData[] | undefined,
) {
    return (
        offer.plantSort.plant?.id ??
        allSorts?.find((sort) => sort.id === offer.plantSort.id)?.information
            .plant.id ??
        null
    );
}

type PlantPickerOptions = {
    scheduledDate: Date | null | undefined;
};

type PlantPickerProps = {
    positionIndex: number;
    gardenId: number;
    raisedBedId: number;
    trigger: ReactElement;
    inShoppingCart?: boolean;
    selectedPlantId?: number | null;
    selectedSortId?: number | null;
    selectedPlantOptions?: PlantPickerOptions | null;
    selectedCartItemId?: number;
};

export function PlantPicker({
    gardenId,
    raisedBedId,
    positionIndex,
    trigger,
    inShoppingCart,
    selectedPlantId: preselectedPlantId,
    selectedSortId: preselectedSortId,
    selectedPlantOptions: preselectedPlantOptions,
    selectedCartItemId,
}: PlantPickerProps) {
    const [open, setOpen] = useState(false);
    const { track } = useGameAnalytics();
    const steps = [
        {
            label: 'Odabir biljke',
            subHeader: 'Odaberi biljku koju želiš posaditi',
        },
        {
            label: 'Odabir sorte',
            subHeader: 'Odaberi sortu biljke koju želiš posaditi',
        },
    ];
    const { data: cart } = useShoppingCart();
    const { data: currentGarden } = useCurrentGarden();
    const raisedBed = currentGarden?.raisedBeds.find(
        (bed) => bed.id === raisedBedId,
    );
    const [outletOfferSelectionParam, setOutletOfferSelectionParam] =
        useOutletOfferSelectionParam();
    const { data: allSorts } = useAllSorts();
    const { data: outletOffers } = useOutletOffers();
    const setCartItem = useSetShoppingCartItem();
    const { data: inventory } = useInventory();
    // Derive sandbox from the gardens list by id (the picker already receives
    // gardenId) so it stays decoupled from the game-state context.
    const { data: gardens } = useGardens();
    const isSandbox = Boolean(
        gardens?.find((garden) => garden.id === gardenId)?.isSandbox,
    );
    const sandboxPlant = useSandboxPlant();
    const [sandboxAgeIndex, setSandboxAgeIndex] = useState(
        SANDBOX_AGE_PRESETS.length - 1,
    );
    const [selectedPlantId, setSelectedPlantId] = useState<number | null>(
        preselectedPlantId ?? null,
    );
    const [selectedSortId, setSelectedSortId] = useState<number | null>(
        preselectedSortId ?? null,
    );
    const [plantOptions, setPlantOptions] = useState<PlantPickerOptions | null>(
        preselectedPlantOptions ?? null,
    );
    const [flyToShoppingCart, setFlyToShoppingCart] = useState(false);
    const [useInventoryItem, setUseInventoryItem] = useState(false);
    const [useOutletOffer, setUseOutletOffer] = useState(false);
    const [sowInGreenhouse, setSowInGreenhouse] = useState(false);
    const [selectedOutletOfferId, setSelectedOutletOfferId] = useState<
        number | null
    >(null);
    const [
        selectedAdvancedSowingLayoutKey,
        setSelectedAdvancedSowingLayoutKey,
    ] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const searchInputId = useId();
    const sowingModeName = useId();
    const plantDateInputId = useId();
    const greenhouseSowingSwitchId = useId();
    const greenhouseSowingLabelId = useId();
    const advancedSowingNoticeId = useId();
    const legacySowingNoticeId = useId();
    const shouldRestoreSearchFocusRef = useRef(false);
    const { enableAdvancedSowingFlag = false } = useGameFlags();

    let currentStep = 0;
    if (selectedPlantId) {
        currentStep = 1;
    }

    // Plant options use local time for tomorrow and 3 months from now.
    const today = new Date();
    const tomorrow = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() + 1,
    );
    const threeMonthsFromTomorrow = new Date(
        tomorrow.getFullYear(),
        tomorrow.getMonth() + 3,
        tomorrow.getDate(),
    );

    useLayoutEffect(() => {
        if (
            currentStep !== 0 ||
            !shouldRestoreSearchFocusRef.current ||
            typeof document === 'undefined'
        ) {
            return;
        }

        const input = document.getElementById(searchInputId);
        if (!(input instanceof HTMLInputElement)) {
            return;
        }

        if (document.activeElement !== input) {
            input.focus();
            input.setSelectionRange(input.value.length, input.value.length);
        }
        shouldRestoreSearchFocusRef.current = false;
    });

    function resetSearch() {
        shouldRestoreSearchFocusRef.current = false;
        setSearch('');
    }

    function handleSearchChange(event: ChangeEvent<HTMLInputElement>) {
        shouldRestoreSearchFocusRef.current = true;
        setSearch(event.target.value);
    }

    function handlePlantSelect(plant: PlantData) {
        setSelectedPlantId(plant.id);
        setSelectedSortId(null);
        setUseOutletOffer(false);
        setSowInGreenhouse(
            isGreenhouseSowingRecommended(
                plant,
                plantOptions?.scheduledDate ?? tomorrow,
            ),
        );
        setSelectedOutletOfferId(null);
        setSelectedAdvancedSowingLayoutKey(null);
        resetSearch();
    }

    function handleSortSelect(sort: PlantSortData) {
        setSelectedSortId(sort.id);
        setUseOutletOffer(false);
        setSelectedOutletOfferId(null);
        setUseInventoryItem(false);
        setSowInGreenhouse(
            isGreenhouseSowingRecommended(
                sort.information.plant,
                plantOptions?.scheduledDate ?? tomorrow,
            ),
        );
        setSelectedAdvancedSowingLayoutKey(null);
        resetSearch();
    }

    async function removeFromCart(existingItem?: ShoppingCartItemData) {
        // Remove existing item if it exists in cart already
        const selectedAdvancedSowingItem = cart?.items.find(
            (item) =>
                item.id === selectedCartItemId &&
                readAdvancedSowingCartItemSelectionSummary(item) !== null,
        );
        const itemToRemove =
            existingItem ??
            selectedAdvancedSowingItem ??
            cart?.items.find(
                (item) =>
                    item.entityTypeName === 'plantSort' &&
                    item.gardenId === gardenId &&
                    item.raisedBedId === raisedBedId &&
                    item.positionIndex === positionIndex,
            );
        if (itemToRemove) {
            await setCartItem.mutateAsync({
                ...itemToRemove,
                gardenId: itemToRemove.gardenId ?? undefined,
                raisedBedId: itemToRemove.raisedBedId ?? undefined,
                positionIndex: itemToRemove.positionIndex ?? undefined,
                amount: 0,
            });
        }
    }

    async function handleRemove() {
        track('game_planting_removed', {
            garden_id: gardenId,
            in_shopping_cart: inShoppingCart,
            position_index: positionIndex,
            raised_bed_id: raisedBedId,
            sort_id: selectedSortId,
        });
        setOpen(false);
        setSelectedPlantId(null);
        setSelectedSortId(null);
        setPlantOptions(null);
        setUseInventoryItem(false);
        setUseOutletOffer(false);
        setSowInGreenhouse(false);
        setSelectedOutletOfferId(null);
        setSelectedAdvancedSowingLayoutKey(null);
        resetSearch();
        await removeFromCart();
    }

    async function handleConfirm() {
        if (!selectedSortId || sowingBlocksMutation) {
            return;
        }

        // Sandbox gardens plant directly at the chosen age — no cart/economy.
        if (isSandbox) {
            const preset = SANDBOX_AGE_PRESETS[sandboxAgeIndex];
            track('game_planting_confirmed', {
                garden_id: gardenId,
                in_shopping_cart: false,
                is_sandbox: true,
                plant_id: selectedPlantId,
                position_index: positionIndex,
                raised_bed_id: raisedBedId,
                sort_id: selectedSortId,
                sandbox_age_days: preset.ageDays,
            });
            try {
                await sandboxPlant.mutateAsync({
                    gardenId,
                    raisedBedId,
                    positionIndex,
                    plantSortId: selectedSortId,
                    ageDays: preset.ageDays,
                    status: preset.status,
                });
            } finally {
                setOpen(false);
                setSelectedPlantId(null);
                setSelectedSortId(null);
                setUseOutletOffer(false);
                setSowInGreenhouse(false);
                setSelectedOutletOfferId(null);
                setSelectedAdvancedSowingLayoutKey(null);
                resetSearch();
            }
            return;
        }

        const advancedSowingSelection = selectedAdvancedSowingOption?.plan
            ? buildAdvancedSowingSelectionRequestV1(
                  selectedAdvancedSowingOption.plan.selectedDistanceCm,
              )
            : undefined;
        const existingItem = advancedSowingSelection
            ? advancedSowingExistingItem
            : cart?.items.find(
                  (item) =>
                      item.entityTypeName === 'plantSort' &&
                      item.gardenId === gardenId &&
                      item.raisedBedId === raisedBedId &&
                      item.positionIndex === positionIndex,
              );

        if (
            advancedSowingSelection &&
            advancedSowingEditedItem &&
            advancedSowingEditedItem.entityId !== selectedSortId.toString()
        ) {
            await removeFromCart(advancedSowingEditedItem);
        } else if (
            !advancedSowingSelection &&
            existingItem &&
            existingItem.entityId !== selectedSortId.toString()
        ) {
            await removeFromCart(existingItem);
        }
        const existingItemCanBeUpdated =
            existingItem?.entityId === selectedSortId.toString();

        // Add new item to cart
        track('game_planting_confirmed', {
            garden_id: gardenId,
            in_shopping_cart: inShoppingCart,
            plant_id: selectedPlantId,
            position_index: positionIndex,
            raised_bed_id: raisedBedId,
            scheduled_date: plantOptions?.scheduledDate?.toISOString(),
            sowing_location: selectedOutletOffer
                ? 'greenhouse'
                : sowInGreenhouse
                  ? 'greenhouse'
                  : 'direct',
            sort_id: selectedSortId,
            use_inventory: useInventoryItem,
            outlet_offer_id: selectedOutletOffer?.id,
            use_outlet_offer: Boolean(selectedOutletOffer),
            advanced_sowing_distance_cm:
                advancedSowingSelection?.selectedDistanceCm,
            advanced_sowing_layout_key:
                selectedAdvancedSowingOption?.plan?.layoutKey,
        });
        showShoppingCartTransientHub();
        setFlyToShoppingCart(true);
        try {
            await setCartItem.mutateAsync(
                useOutletOffer && selectedOutletOffer
                    ? buildOutletCartItemPayload({
                          cartItemId: existingItemCanBeUpdated
                              ? existingItem.id
                              : undefined,
                          currency:
                              existingItemCanBeUpdated &&
                              existingItem.currency === 'inventory'
                                  ? 'eur'
                                  : undefined,
                          gardenId,
                          outletOfferId: selectedOutletOffer.id,
                          plantSortId: selectedSortId,
                          positionIndex,
                          raisedBedId,
                      })
                    : {
                          entityTypeName: 'plantSort',
                          entityId: selectedSortId.toString(),
                          id: existingItemCanBeUpdated
                              ? existingItem.id
                              : undefined,
                          amount: 1,
                          gardenId,
                          raisedBedId,
                          positionIndex,
                          additionalData: JSON.stringify({
                              scheduledDate:
                                  plantOptions?.scheduledDate?.toISOString(),
                              ...(sowInGreenhouse
                                  ? { sowingLocation: 'greenhouse' }
                                  : {}),
                          }),
                          currency: useInventoryItem ? 'inventory' : undefined,
                          ...(advancedSowingSelection
                              ? {
                                    advancedSowingSelection,
                                    forceCreate: !existingItemCanBeUpdated,
                                }
                              : {}),
                      },
            );
            await new Promise((resolve) => setTimeout(resolve, 800)); // Wait for animation to finish
        } finally {
            scheduleHideShoppingCartTransientHub();
            setOpen(false);
            setFlyToShoppingCart(false);
        }
    }

    function handleOpenChange(open: boolean) {
        if (open) {
            track('game_plant_picker_opened', {
                garden_id: gardenId,
                in_shopping_cart: inShoppingCart,
                position_index: positionIndex,
                raised_bed_id: raisedBedId,
            });
        }
        setOpen(open);
        if (open) {
            const selectedAdvancedSowingItem =
                typeof preselectedSortId === 'number'
                    ? findAdvancedSowingCartItem({
                          cartItems: cart?.items ?? [],
                          gardenId,
                          plantSortId: preselectedSortId,
                          positionIndex,
                          raisedBedId,
                          selectedCartItemId,
                      })
                    : null;
            setSelectedAdvancedSowingLayoutKey(
                readAdvancedSowingCartItemSelectionSummary(
                    selectedAdvancedSowingItem,
                )?.layoutKey ?? null,
            );
        }

        const selectedOutletOfferFromParam =
            open && typeof outletOfferSelectionParam === 'number'
                ? outletOffers?.find(
                      (offer) => offer.id === outletOfferSelectionParam,
                  )
                : undefined;
        const selectedOutletPlantId = selectedOutletOfferFromParam
            ? outletOfferPlantId(selectedOutletOfferFromParam, allSorts)
            : null;

        if (selectedOutletOfferFromParam && selectedOutletPlantId) {
            const selectedOutletPlant = allSorts?.find(
                (sort) => sort.id === selectedOutletOfferFromParam.plantSort.id,
            )?.information.plant;
            setSelectedPlantId(selectedOutletPlantId);
            setSelectedSortId(selectedOutletOfferFromParam.plantSort.id);
            setPlantOptions(null);
            setUseInventoryItem(false);
            setUseOutletOffer(true);
            setSowInGreenhouse(
                isGreenhouseSowingRecommended(selectedOutletPlant, tomorrow),
            );
            setSelectedOutletOfferId(selectedOutletOfferFromParam.id);
            void setOutletOfferSelectionParam(null);
            resetSearch();
            return;
        }

        setSelectedPlantId(preselectedPlantId ?? null);
        setSelectedSortId(preselectedSortId ?? null);
        setPlantOptions(preselectedPlantOptions ?? null);
        resetSearch();
        const existingItem =
            cart?.items.find((item) => item.id === selectedCartItemId) ??
            cart?.items.find(
                (item) =>
                    item.entityTypeName === 'plantSort' &&
                    item.gardenId === gardenId &&
                    item.raisedBedId === raisedBedId &&
                    item.positionIndex === positionIndex,
            );
        setUseInventoryItem(existingItem?.currency === 'inventory');
        setUseOutletOffer(Boolean(existingItem?.outlet));
        const preselectedPlant =
            allSorts?.find((sort) => sort.id === preselectedSortId)?.information
                .plant ??
            allSorts?.find(
                (sort) => sort.information.plant.id === preselectedPlantId,
            )?.information.plant;
        setSowInGreenhouse(
            existingItem
                ? isGreenhouseSowing(existingItem.additionalData)
                : isGreenhouseSowingRecommended(
                      preselectedPlant,
                      preselectedPlantOptions?.scheduledDate ?? tomorrow,
                  ),
        );
        setSelectedOutletOfferId(existingItem?.outlet?.offerId ?? null);
    }

    function handleGreenhouseSowingChange(checked: boolean) {
        track('game_greenhouse_sowing_toggled', {
            garden_id: gardenId,
            position_index: positionIndex,
            raised_bed_id: raisedBedId,
            sort_id: selectedSortId,
            sow_in_greenhouse: checked,
        });
        setSowInGreenhouse(checked);
    }

    const plantDate = formatLocalDate(plantOptions?.scheduledDate ?? tomorrow);
    function handlePlantDateChange(date: string) {
        const scheduledDate = date ? new Date(date) : null;
        const localCalendarDate = parseCalendarDateKey(date);
        setPlantOptions({
            scheduledDate,
        });
        if (localCalendarDate && selectedSort) {
            setSowInGreenhouse(
                isGreenhouseSowingRecommended(
                    selectedSort.information.plant,
                    localCalendarDate,
                ),
            );
        }
    }

    const min = formatLocalDate(tomorrow);
    const max = formatLocalDate(threeMonthsFromTomorrow);

    const inventoryAvailabilityBySortId = useMemo(() => {
        const availabilityBySortId = new Map<number, number>();
        for (const item of inventory?.items ?? []) {
            if (item.entityTypeName !== 'plantSort') {
                continue;
            }

            const sortId = Number(item.entityId);
            if (!Number.isInteger(sortId) || item.amount <= 0) {
                continue;
            }

            availabilityBySortId.set(
                sortId,
                (availabilityBySortId.get(sortId) ?? 0) + item.amount,
            );
        }

        return availabilityBySortId;
    }, [inventory?.items]);
    const outletOffersBySortId = useMemo(
        () => groupOutletOffersBySortId(outletOffers),
        [outletOffers],
    );
    const outletOffersByPlantId = useMemo(
        () => groupOutletOffersByPlantId(outletOffers, allSorts),
        [allSorts, outletOffers],
    );
    const selectedOutletOffers = selectedSortId
        ? (outletOffersBySortId.get(selectedSortId) ?? [])
        : [];
    const selectedOutletOffer = useOutletOffer
        ? selectedOutletOfferId
            ? selectedOutletOffers.find(
                  (offer) => offer.id === selectedOutletOfferId,
              )
            : selectedOutletOffers[0]
        : undefined;
    const selectedOutletOfferUnavailable =
        useOutletOffer &&
        selectedOutletOfferId !== null &&
        selectedOutletOffer === undefined;
    const selectedSort = selectedSortId
        ? allSorts?.find((sort) => sort.id === selectedSortId)
        : undefined;
    const raisedBedFieldCount = ADVANCED_SOWING_DEFAULT_BED_FIELD_COUNT;
    const raisedBedSource: unknown = raisedBed;
    const raisedBedPlantings = isRecord(raisedBedSource)
        ? raisedBedSource.plantings
        : null;
    const advancedSowingPreview = useMemo(
        () =>
            enableAdvancedSowingFlag && !isSandbox && selectedSort
                ? createAdvancedSowingPickerPreview({
                      anchorPositionIndex: positionIndex,
                      attributes: selectedSort.information.plant.attributes,
                      bedFieldCount: raisedBedFieldCount,
                  })
                : ({ status: 'unsupported' } as const),
        [enableAdvancedSowingFlag, isSandbox, positionIndex, selectedSort],
    );
    const advancedSowingEditedItem =
        typeof selectedCartItemId === 'number'
            ? cart?.items.find(
                  (item) =>
                      item.id === selectedCartItemId &&
                      readAdvancedSowingCartItemSelectionSummary(item) !== null,
              )
            : undefined;
    const advancedSowingExistingItem =
        selectedSortId && typeof selectedCartItemId === 'number'
            ? findAdvancedSowingCartItem({
                  cartItems: cart?.items ?? [],
                  gardenId,
                  plantSortId: selectedSortId,
                  positionIndex,
                  raisedBedId,
                  selectedCartItemId,
              })
            : null;
    const advancedSowingUnavailableLayoutKeys = useMemo(() => {
        if (advancedSowingPreview.status !== 'supported') {
            return new Set<string>();
        }

        return new Set(
            advancedSowingPreview.options.flatMap((option) =>
                option.plan &&
                !getAdvancedSowingPlanAvailability({
                    cartItems: cart?.items ?? [],
                    excludedCartItemId: advancedSowingEditedItem?.id,
                    gardenId,
                    plan: option.plan,
                    plantings: raisedBedPlantings,
                    raisedBedId,
                }).available
                    ? [option.layout.layoutKey]
                    : [],
            ),
        );
    }, [
        advancedSowingEditedItem?.id,
        advancedSowingPreview,
        cart?.items,
        gardenId,
        raisedBedPlantings,
        raisedBedId,
    ]);
    const selectedAdvancedSowingOption = getSelectedAdvancedSowingPickerOption(
        advancedSowingPreview,
        selectedAdvancedSowingLayoutKey,
        advancedSowingUnavailableLayoutKeys,
    );
    const advancedSowingBlocksMutation =
        advancedSowingPreview.status === 'invalid' ||
        (advancedSowingPreview.status === 'supported' &&
            (!selectedAdvancedSowingOption?.plan ||
                Boolean(selectedOutletOffer)));
    const legacySowingTargetAvailability = useMemo(
        () =>
            getLegacySowingTargetAvailability({
                plantings: raisedBedPlantings,
                positionIndex,
            }),
        [positionIndex, raisedBedPlantings],
    );
    const legacySowingBlocksMutation =
        !legacySowingTargetAvailability.available &&
        !selectedAdvancedSowingOption?.plan;
    const sowingBlocksMutation =
        advancedSowingBlocksMutation || legacySowingBlocksMutation;
    const sowingMutationNoticeId = legacySowingBlocksMutation
        ? legacySowingNoticeId
        : advancedSowingBlocksMutation
          ? advancedSowingNoticeId
          : undefined;
    const relationshipBlockCount = getRaisedBedRelationshipBlockCount({
        cartItems: cart?.items,
        fields: raisedBed?.fields,
        positionIndex,
    });
    const neighborPlants = getNeighborPlantSummaries({
        blockCount: relationshipBlockCount,
        cartItems: cart?.items,
        fields: raisedBed?.fields,
        gardenId,
        positionIndex,
        raisedBedId,
        sorts: allSorts,
    });
    function handleSortInventoryToggle(sort: PlantSortData) {
        const nextUseInventory = !(
            selectedSortId === sort.id && useInventoryItem
        );
        track('game_plant_inventory_toggled', {
            garden_id: gardenId,
            position_index: positionIndex,
            raised_bed_id: raisedBedId,
            sort_id: sort.id,
            use_inventory: nextUseInventory,
        });
        setSelectedSortId(sort.id);
        setUseOutletOffer(false);
        setSelectedOutletOfferId(null);
        setUseInventoryItem(nextUseInventory);
        setSelectedAdvancedSowingLayoutKey(null);
        resetSearch();
    }

    return (
        <GameModal
            trigger={trigger}
            open={open}
            onOpenChange={handleOpenChange}
            title={'Sijanje biljke'}
            modal={false}
            className="md:max-w-2xl"
        >
            <Stack spacing={4}>
                <SegmentedProgress
                    className="pb-4 pr-8 w-full md:w-80 self-center"
                    segments={steps.map((step, stepIndex) => ({
                        value:
                            currentStep > stepIndex
                                ? 100
                                : currentStep < stepIndex
                                  ? 0
                                  : 99,
                        highlighted: stepIndex === currentStep,
                        label: step.label,
                        onClick:
                            selectedPlantId && stepIndex === 0
                                ? () => {
                                      setSelectedPlantId(null);
                                      setSelectedSortId(null);
                                      setUseOutletOffer(false);
                                      setSelectedOutletOfferId(null);
                                      resetSearch();
                                  }
                                : undefined,
                    }))}
                />
                <Stack>
                    <Typography level="h3" className="text-xl">
                        {steps[currentStep].label}
                    </Typography>
                    <Typography level="body2">
                        {steps[currentStep].subHeader}
                    </Typography>
                    {neighborPlants.length > 0 && (
                        <Button
                            className="self-start px-0"
                            href={KnownPages.GrediceCompanionPlanting}
                            size="sm"
                            variant="link"
                        >
                            Kako čitati biljne susjede
                        </Button>
                    )}
                </Stack>
                {currentStep < 1 && (
                    <Input
                        id={searchInputId}
                        name="plantSearch"
                        value={search}
                        onChange={handleSearchChange}
                        placeholder="Pretraži..."
                        startDecorator={
                            <Search className="size-5 shrink-0 ml-3" />
                        }
                        endDecorator={
                            <IconButton
                                className={cx(
                                    'hover:bg-neutral-300 mr-1 rounded-full aspect-square',
                                    search ? 'visible' : 'invisible',
                                )}
                                title="Očisti pretragu"
                                type="button"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => {
                                    shouldRestoreSearchFocusRef.current = true;
                                    setSearch('');
                                }}
                                size="sm"
                                variant="plain"
                            >
                                <Close className="size-5" />
                            </IconButton>
                        }
                        className="min-w-60"
                        variant="soft"
                    />
                )}
                {currentStep === 0 && (
                    <PlantsList
                        neighborPlants={neighborPlants}
                        outletOffersByPlantId={outletOffersByPlantId}
                        search={search}
                        onChange={handlePlantSelect}
                    />
                )}
                {currentStep === 1 && selectedPlantId && (
                    <>
                        <Stack spacing={4} className="pb-8 md:pb-0">
                            <PlantsSortList
                                plantId={selectedPlantId}
                                selectedSortId={selectedSortId}
                                onChange={handleSortSelect}
                                search={search}
                                neighborPlants={neighborPlants}
                                flyToShoppingCart={flyToShoppingCart}
                                outletOffersBySortId={outletOffersBySortId}
                                inventoryAvailabilityBySortId={
                                    inventoryAvailabilityBySortId
                                }
                                inventorySelectedSortId={
                                    useInventoryItem ? selectedSortId : null
                                }
                                onInventoryToggle={handleSortInventoryToggle}
                            />
                            {advancedSowingPreview.status !== 'unsupported' ? (
                                <AdvancedSowingPickerPreview
                                    bedFieldCount={raisedBedFieldCount}
                                    noticeId={advancedSowingNoticeId}
                                    onLayoutChange={
                                        setSelectedAdvancedSowingLayoutKey
                                    }
                                    preview={advancedSowingPreview}
                                    selectedLayoutKey={
                                        selectedAdvancedSowingLayoutKey
                                    }
                                    unavailableLayoutKeys={
                                        advancedSowingUnavailableLayoutKeys
                                    }
                                />
                            ) : null}
                            {legacySowingBlocksMutation && selectedSortId ? (
                                <Typography
                                    className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
                                    id={legacySowingNoticeId}
                                    level="body2"
                                    role="alert"
                                >
                                    Ovo polje pripada postojećoj naprednoj
                                    sjetvi. Obična sjetva ovdje nije dostupna;
                                    odaberi podržani drugačiji raspored ili
                                    drugo polje.
                                </Typography>
                            ) : null}
                            {isSandbox ? (
                                <Stack spacing={1}>
                                    <Typography level="body2" semiBold>
                                        Starost biljke
                                    </Typography>
                                    <Row spacing={1} className="flex-wrap">
                                        {SANDBOX_AGE_PRESETS.map(
                                            (preset, presetIndex) => (
                                                <Button
                                                    key={preset.label}
                                                    variant={
                                                        presetIndex ===
                                                        sandboxAgeIndex
                                                            ? 'solid'
                                                            : 'outlined'
                                                    }
                                                    size="sm"
                                                    onClick={() =>
                                                        setSandboxAgeIndex(
                                                            presetIndex,
                                                        )
                                                    }
                                                >
                                                    {preset.label}
                                                </Button>
                                            ),
                                        )}
                                    </Row>
                                </Stack>
                            ) : (
                                <>
                                    {selectedOutletOffers.length > 0 ||
                                    selectedOutletOfferUnavailable ? (
                                        <Stack spacing={2}>
                                            <Typography level="body2" semiBold>
                                                Način sijanja
                                            </Typography>
                                            <div
                                                role="radiogroup"
                                                aria-label="Način sijanja"
                                                className="grid gap-2 md:grid-cols-2"
                                            >
                                                <label
                                                    className={cx(
                                                        'block cursor-pointer rounded-lg border p-3 text-left transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
                                                        !useOutletOffer
                                                            ? 'border-green-500 bg-green-50 text-green-950 dark:border-green-700 dark:bg-green-950/40 dark:text-green-100'
                                                            : 'border-input bg-card hover:bg-muted',
                                                    )}
                                                >
                                                    <input
                                                        type="radio"
                                                        className="sr-only"
                                                        name={sowingModeName}
                                                        value="scheduled"
                                                        checked={
                                                            !useOutletOffer
                                                        }
                                                        onChange={() => {
                                                            track(
                                                                'game_outlet_offer_toggled',
                                                                {
                                                                    garden_id:
                                                                        gardenId,
                                                                    outlet_offer_id:
                                                                        selectedOutletOfferId ??
                                                                        selectedOutletOffer?.id,
                                                                    position_index:
                                                                        positionIndex,
                                                                    raised_bed_id:
                                                                        raisedBedId,
                                                                    sort_id:
                                                                        selectedSortId,
                                                                    use_outlet_offer: false,
                                                                },
                                                            );
                                                            setUseOutletOffer(
                                                                false,
                                                            );
                                                            setSelectedOutletOfferId(
                                                                null,
                                                            );
                                                        }}
                                                    />
                                                    <Row
                                                        alignItems="start"
                                                        justifyContent="space-between"
                                                        spacing={2}
                                                    >
                                                        <Stack
                                                            spacing={1}
                                                            className="min-w-0"
                                                        >
                                                            <Typography
                                                                level="body2"
                                                                semiBold
                                                            >
                                                                Planirano
                                                                sijanje
                                                            </Typography>
                                                            <Typography
                                                                level="body3"
                                                                secondary
                                                            >
                                                                Odaberi termin
                                                                za novu biljku.
                                                            </Typography>
                                                        </Stack>
                                                        {!useOutletOffer ? (
                                                            <Check className="size-5 shrink-0" />
                                                        ) : null}
                                                    </Row>
                                                </label>
                                                {selectedOutletOffers.map(
                                                    (offer) => {
                                                        const selected =
                                                            selectedOutletOffer?.id ===
                                                            offer.id;

                                                        return (
                                                            <label
                                                                key={offer.id}
                                                                className={cx(
                                                                    'block cursor-pointer rounded-lg border p-3 text-left transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
                                                                    selected
                                                                        ? 'border-green-500 bg-green-50 text-green-950 dark:border-green-700 dark:bg-green-950/40 dark:text-green-100'
                                                                        : 'border-input bg-card hover:bg-muted',
                                                                )}
                                                            >
                                                                <input
                                                                    type="radio"
                                                                    className="sr-only"
                                                                    name={
                                                                        sowingModeName
                                                                    }
                                                                    value={`outlet-${offer.id}`}
                                                                    checked={
                                                                        selected
                                                                    }
                                                                    onChange={() => {
                                                                        track(
                                                                            'game_outlet_offer_toggled',
                                                                            {
                                                                                garden_id:
                                                                                    gardenId,
                                                                                outlet_offer_id:
                                                                                    offer.id,
                                                                                position_index:
                                                                                    positionIndex,
                                                                                raised_bed_id:
                                                                                    raisedBedId,
                                                                                sort_id:
                                                                                    selectedSortId,
                                                                                use_outlet_offer: true,
                                                                            },
                                                                        );
                                                                        setUseOutletOffer(
                                                                            true,
                                                                        );
                                                                        setSelectedOutletOfferId(
                                                                            offer.id,
                                                                        );
                                                                        setUseInventoryItem(
                                                                            false,
                                                                        );
                                                                    }}
                                                                />
                                                                <Row
                                                                    alignItems="start"
                                                                    justifyContent="space-between"
                                                                    spacing={2}
                                                                >
                                                                    <Stack
                                                                        spacing={
                                                                            1
                                                                        }
                                                                        className="min-w-0"
                                                                    >
                                                                        <Typography
                                                                            level="body2"
                                                                            semiBold
                                                                        >
                                                                            <span className="inline-flex items-center gap-1.5">
                                                                                <Discount
                                                                                    aria-hidden
                                                                                    className="size-4 shrink-0"
                                                                                />
                                                                                Outlet
                                                                                sadnica
                                                                            </span>
                                                                        </Typography>
                                                                        <Typography
                                                                            level="body3"
                                                                            secondary
                                                                        >
                                                                            Sjetva{' '}
                                                                            {outletDateFormatter.format(
                                                                                new Date(
                                                                                    offer.sowingDate,
                                                                                ),
                                                                            )}{' '}
                                                                            ·{' '}
                                                                            {outletCurrencyFormatter.format(
                                                                                offer.outletPrice,
                                                                            )}
                                                                        </Typography>
                                                                        <Typography
                                                                            level="body3"
                                                                            secondary
                                                                        >
                                                                            Preostalo{' '}
                                                                            {
                                                                                offer.remainingQuantity
                                                                            }{' '}
                                                                            · do{' '}
                                                                            {outletDateFormatter.format(
                                                                                new Date(
                                                                                    offer.endAt,
                                                                                ),
                                                                            )}
                                                                        </Typography>
                                                                    </Stack>
                                                                    {selected ? (
                                                                        <Check className="size-5 shrink-0" />
                                                                    ) : null}
                                                                </Row>
                                                            </label>
                                                        );
                                                    },
                                                )}
                                            </div>
                                            {selectedOutletOfferUnavailable ? (
                                                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                                                    Odabrana outlet sadnica više
                                                    nije dostupna. Odaberi drugu
                                                    outlet sadnicu ili planirano
                                                    sijanje.
                                                </div>
                                            ) : null}
                                        </Stack>
                                    ) : null}
                                    {selectedOutletOffer ? (
                                        <div className="rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-900 dark:border-green-900 dark:bg-green-950/40 dark:text-green-100">
                                            Presadnica je posijana{' '}
                                            {outletDateFormatter.format(
                                                new Date(
                                                    selectedOutletOffer.sowingDate,
                                                ),
                                            )}{' '}
                                            u stakleniku. Rezervacija se čuva
                                            kratko nakon dodavanja u košaru.
                                        </div>
                                    ) : selectedOutletOfferUnavailable ? null : (
                                        <div className="grid grid-cols-[minmax(0,1fr)_minmax(6.75rem,auto)] items-end gap-2 rounded-lg border border-green-200 bg-green-50/70 p-3 dark:border-green-900 dark:bg-green-950/30">
                                            <div className="min-w-0 space-y-1.5">
                                                <CalendarDatePicker
                                                    className="w-full border-green-200 bg-card dark:border-green-900"
                                                    fullWidth
                                                    id={plantDateInputId}
                                                    label={
                                                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                            <Calendar className="size-4 shrink-0 text-green-700 dark:text-green-300" />
                                                            <span className="min-w-0">
                                                                Datum sijanja
                                                            </span>
                                                        </span>
                                                    }
                                                    max={max}
                                                    min={min}
                                                    name="plantDate"
                                                    onValueChange={(date) =>
                                                        handlePlantDateChange(
                                                            date,
                                                        )
                                                    }
                                                    value={plantDate}
                                                />
                                            </div>
                                            <div className="min-w-0 space-y-1.5">
                                                <label
                                                    className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
                                                    htmlFor={
                                                        greenhouseSowingSwitchId
                                                    }
                                                    id={greenhouseSowingLabelId}
                                                >
                                                    <Sprout className="size-4 shrink-0 text-green-700 dark:text-green-300" />
                                                    <span className="min-w-0">
                                                        Sijanje u stakleniku
                                                    </span>
                                                </label>
                                                <div className="flex h-10 items-center justify-center rounded-md border border-green-200 bg-card px-3 dark:border-green-900">
                                                    <Switch
                                                        aria-labelledby={
                                                            greenhouseSowingLabelId
                                                        }
                                                        checked={
                                                            sowInGreenhouse
                                                        }
                                                        id={
                                                            greenhouseSowingSwitchId
                                                        }
                                                        onCheckedChange={
                                                            handleGreenhouseSowingChange
                                                        }
                                                        size="sm"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </Stack>
                        <Row
                            data-plant-picker-actions
                            className="-mx-4 -mb-4 sticky bottom-0 z-10 flex-wrap items-center justify-between gap-2 border-t bg-background/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-xs max-[340px]:flex-col max-[340px]:items-stretch max-[340px]:justify-start md:static md:mx-0 md:mb-0 md:flex-nowrap md:border-t-0 md:bg-transparent md:p-0 md:backdrop-blur-none"
                        >
                            <Button
                                variant="plain"
                                className="min-w-0 justify-start whitespace-nowrap px-2 max-[340px]:justify-center md:justify-start"
                                onClick={() => {
                                    setSelectedPlantId(null);
                                    setSelectedSortId(null);
                                    setUseOutletOffer(false);
                                    setSelectedOutletOfferId(null);
                                    resetSearch();
                                }}
                                startDecorator={<Left className="size-5" />}
                            >
                                Odabir biljke
                            </Button>
                            <Row
                                spacing={2}
                                className="min-w-0 flex-wrap justify-end max-[340px]:w-full max-[340px]:flex-col-reverse max-[340px]:items-stretch"
                            >
                                {inShoppingCart && (
                                    <Button
                                        variant="plain"
                                        className="whitespace-nowrap"
                                        loading={setCartItem.isPending}
                                        onClick={handleRemove}
                                    >
                                        Ukloni
                                    </Button>
                                )}
                                <Button
                                    aria-describedby={sowingMutationNoticeId}
                                    variant="solid"
                                    className="whitespace-nowrap"
                                    disabled={
                                        !selectedSortId ||
                                        selectedOutletOfferUnavailable ||
                                        sowingBlocksMutation
                                    }
                                    title={
                                        !selectedSortId
                                            ? 'Odaberi sortu prije potvrde'
                                            : selectedOutletOfferUnavailable
                                              ? 'Odabrana outlet sadnica više nije dostupna'
                                              : legacySowingBlocksMutation
                                                ? 'Obična sjetva nije dostupna na polju postojeće napredne sjetve'
                                                : advancedSowingBlocksMutation
                                                  ? selectedOutletOffer
                                                      ? 'Napredna sjetva nije dostupna za outlet sadnice'
                                                      : 'Odabrani raspored nije dostupan na ovim poljima'
                                                  : undefined
                                    }
                                    loading={
                                        isSandbox
                                            ? sandboxPlant.isPending
                                            : setCartItem.isPending
                                    }
                                    onClick={handleConfirm}
                                    startDecorator={
                                        isSandbox ? (
                                            <PlantingSeedIcon className="shrink-0 size-5" />
                                        ) : (
                                            <ShoppingCart className="shrink-0 size-5" />
                                        )
                                    }
                                >
                                    {isSandbox ? 'Posadi' : 'Dodaj u košaru'}
                                </Button>
                            </Row>
                        </Row>
                    </>
                )}
            </Stack>
        </GameModal>
    );
}
