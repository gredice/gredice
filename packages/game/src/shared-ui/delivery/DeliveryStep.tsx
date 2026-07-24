import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { IconButton } from '@gredice/ui/IconButton';
import { Edit, Info, Navigate } from '@gredice/ui/icons';
import { NoDataPlaceholder } from '@gredice/ui/NoDataPlaceholder';
import { Row } from '@gredice/ui/Row';
import { SelectItems } from '@gredice/ui/SelectItems';
import { Skeleton } from '@gredice/ui/Skeleton';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useEffect, useMemo, useState } from 'react';
import { useDeliveryAddresses } from '../../hooks/useDeliveryAddresses';
import { usePickupLocations } from '../../hooks/usePickupLocations';
import { useTimeSlots } from '../../hooks/useTimeSlots';
import { DeliveryAddressesSection } from './DeliveryAddressesSection';
import {
    DeliverySlotPicker,
    type DeliverySlotPickerSlot,
} from './DeliverySlotPicker';
import { isDeliverySlotAvailable } from './deliverySlotAvailability';

export interface DeliverySelectionData {
    mode: 'delivery' | 'pickup';
    addressId?: number;
    locationId?: number;
    slotId?: number;
    notes?: string;
}

export interface DeliveryStepSummary {
    mode: 'delivery' | 'pickup';
    startAt: string;
    endAt: string;
    destinationLabel: string;
}

interface DeliveryStepProps {
    initialSelection?: DeliverySelectionData | null;
    onSelectionChange: (selection: DeliverySelectionData | null) => void;
    onBack: () => void;
    onProceed: (summary: DeliveryStepSummary) => void;
    isValid: boolean;
}

export function DeliveryStep({
    initialSelection,
    onSelectionChange,
    onBack,
    onProceed,
    isValid,
}: DeliveryStepProps) {
    const [selection, setSelection] = useState<DeliverySelectionData>(
        initialSelection ?? {
            mode: 'delivery',
        },
    );
    const [manageAddresses, setManageAddresses] = useState(false);
    const [slotRange] = useState(() => {
        const referenceDate = new Date();
        const from = new Date(referenceDate);
        const daysFromMonday = (from.getDay() + 6) % 7;
        from.setDate(from.getDate() - daysFromMonday);
        from.setHours(0, 0, 0, 0);

        const to = new Date(referenceDate);
        to.setMonth(to.getMonth() + 1);

        return {
            from: from.toISOString(),
            referenceDate: referenceDate.toISOString(),
            to: to.toISOString(),
        };
    });
    const { data: addresses, isLoading: isLoadingAddresses } =
        useDeliveryAddresses();
    const { data: pickupLocations } = usePickupLocations();
    const { data: timeSlots, isLoading: slotsLoading } = useTimeSlots({
        from: slotRange.from,
        includeArchived: true,
        includeClosed: true,
        to: slotRange.to,
    });
    const pickerSlots = useMemo<DeliverySlotPickerSlot[]>(
        () =>
            (timeSlots ?? []).flatMap((slot) => {
                if (slot.type !== 'delivery' && slot.type !== 'pickup') {
                    return [];
                }

                return [
                    {
                        id: slot.id,
                        startAt: slot.startAt,
                        endAt: slot.endAt,
                        fulfillment: slot.type,
                        disabled: !isDeliverySlotAvailable(
                            slot,
                            slotRange.referenceDate,
                        ),
                    },
                ];
            }),
        [slotRange.referenceDate, timeSlots],
    );
    const selectedTimeSlot = timeSlots?.find(
        (slot) => slot.id === selection.slotId,
    );
    const selectedAddress = addresses?.find(
        (address) => address.id === selection.addressId,
    );
    const selectedPickupLocation = pickupLocations?.find(
        (location) =>
            location.id === selection.locationId &&
            location.id === selectedTimeSlot?.locationId,
    );
    const selectedSlotAvailable =
        selectedTimeSlot !== undefined &&
        (selectedTimeSlot.type === 'delivery' ||
            selectedTimeSlot.type === 'pickup') &&
        isDeliverySlotAvailable(selectedTimeSlot, slotRange.referenceDate);
    const canProceed =
        isValid &&
        selectedSlotAvailable &&
        selection.mode === selectedTimeSlot.type &&
        (selectedTimeSlot.type === 'delivery'
            ? selectedAddress !== undefined
            : selectedPickupLocation !== undefined);
    const pickupDestinationLabel = selectedPickupLocation
        ? `${selectedPickupLocation.name} — ${selectedPickupLocation.street1}, ${selectedPickupLocation.postalCode} ${selectedPickupLocation.city}`
        : 'odabranoj lokaciji';

    useEffect(() => {
        if (
            selectedTimeSlot?.type !== 'delivery' ||
            isLoadingAddresses ||
            !addresses?.length ||
            addresses.some((address) => address.id === selection.addressId)
        ) {
            return;
        }

        const defaultAddress =
            addresses.find((address) => address.isDefault) ?? addresses[0];

        setSelection((previous) => ({
            ...previous,
            addressId: defaultAddress.id,
        }));
    }, [
        addresses,
        isLoadingAddresses,
        selectedTimeSlot?.type,
        selection.addressId,
    ]);

    useEffect(() => {
        const isComplete =
            typeof selection.slotId === 'number' &&
            (selection.mode === 'delivery'
                ? typeof selection.addressId === 'number'
                : typeof selection.locationId === 'number');

        onSelectionChange(isComplete ? selection : null);
    }, [selection, onSelectionChange]);

    function handleSlotChange(slotId: number | undefined) {
        if (slotId === undefined) {
            setSelection((previous) => ({
                ...previous,
                slotId: undefined,
            }));
            return;
        }

        const slot = timeSlots?.find((candidate) => candidate.id === slotId);

        if (!slot || (slot.type !== 'delivery' && slot.type !== 'pickup')) {
            return;
        }

        setSelection((previous) =>
            slot.type === 'delivery'
                ? {
                      ...previous,
                      mode: 'delivery',
                      slotId,
                      locationId: undefined,
                  }
                : {
                      ...previous,
                      mode: 'pickup',
                      slotId,
                      addressId: undefined,
                      locationId: slot.locationId,
                  },
        );
    }

    function handleAddressChange(addressId: number) {
        setSelection((previous) => ({
            ...previous,
            addressId,
            locationId: undefined,
        }));
    }

    if (manageAddresses) {
        return (
            <Stack spacing={8}>
                <Row spacing={2}>
                    <IconButton
                        title="Natrag na dostavu"
                        variant="plain"
                        onClick={() => setManageAddresses(false)}
                    >
                        <Navigate className="size-5 shrink-0 rotate-180" />
                    </IconButton>
                    <Typography level="h3">Upravljanje adresama</Typography>
                </Row>
                <div className="max-h-[50vh] overflow-y-auto">
                    <DeliveryAddressesSection />
                </div>
            </Stack>
        );
    }

    return (
        <Stack spacing={6}>
            <DeliverySlotPicker
                description="Odaberi termin dostave ili osobnog preuzimanja."
                emptyMessage="Trenutno nema dostupnih termina dostave ili osobnog preuzimanja."
                label={null}
                loading={slotsLoading}
                referenceDate={slotRange.referenceDate}
                slots={pickerSlots}
                value={selection.slotId}
                onValueChange={handleSlotChange}
            />

            {selectedTimeSlot?.type === 'pickup' && (
                <Alert
                    color="warning"
                    startDecorator={<Info className="size-5 shrink-0" />}
                >
                    <strong>Odabrano je osobno preuzimanje.</strong> Narudžbu
                    preuzimaš na {pickupDestinationLabel}; neće biti dostavljena
                    na tvoju adresu.
                </Alert>
            )}

            {selectedTimeSlot?.type === 'delivery' && (
                <Row alignItems="end" className="min-w-0" spacing={2}>
                    {isLoadingAddresses ? (
                        <Skeleton className="h-10 min-w-0 flex-1 rounded-md" />
                    ) : addresses?.length ? (
                        <SelectItems
                            className="min-w-0 flex-1"
                            items={addresses.map((address) => ({
                                label: `${address.label} - ${address.street1}, ${address.city}`,
                                value: address.id.toString(),
                            }))}
                            label="Adresa za dostavu"
                            placeholder="Odaberi adresu..."
                            value={selection.addressId?.toString() ?? ''}
                            onValueChange={(value) =>
                                handleAddressChange(Number.parseInt(value, 10))
                            }
                        />
                    ) : (
                        <NoDataPlaceholder className="min-w-0 flex-1">
                            Dodaj adresu za dostavu kako bi mogao nastaviti.
                        </NoDataPlaceholder>
                    )}
                    <Button
                        className="shrink-0"
                        onClick={() => setManageAddresses(true)}
                        startDecorator={<Edit className="size-4 shrink-0" />}
                        variant={addresses?.length ? 'outlined' : 'solid'}
                    >
                        Moje adrese
                    </Button>
                </Row>
            )}

            <Row spacing={4} justifyContent="end">
                <Button variant="outlined" onClick={onBack}>
                    Natrag
                </Button>
                <Button
                    variant="solid"
                    disabled={!canProceed}
                    endDecorator={<Navigate className="size-5 shrink-0" />}
                    onClick={() => {
                        if (
                            !canProceed ||
                            !selectedTimeSlot ||
                            (selectedTimeSlot.type !== 'delivery' &&
                                selectedTimeSlot.type !== 'pickup')
                        ) {
                            return;
                        }

                        onProceed({
                            mode: selectedTimeSlot.type,
                            startAt: new Date(
                                selectedTimeSlot.startAt,
                            ).toISOString(),
                            endAt: new Date(
                                selectedTimeSlot.endAt,
                            ).toISOString(),
                            destinationLabel:
                                selectedTimeSlot.type === 'pickup'
                                    ? pickupDestinationLabel
                                    : selectedAddress
                                      ? `${selectedAddress.label} — ${selectedAddress.street1}, ${selectedAddress.city}`
                                      : 'Adresa za dostavu',
                        });
                    }}
                >
                    Nastavi
                </Button>
            </Row>
        </Stack>
    );
}
