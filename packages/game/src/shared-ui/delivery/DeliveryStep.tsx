import { Alert } from '@signalco/ui/Alert';
import { NoDataPlaceholder } from '@signalco/ui/NoDataPlaceholder';
import {
    Edit,
    Map as MapIcon,
    Navigate,
    ShoppingCart,
    Truck,
} from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { Card, CardContent } from '@signalco/ui-primitives/Card';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { Row } from '@signalco/ui-primitives/Row';
import { SelectItems } from '@signalco/ui-primitives/SelectItems';
import { Skeleton } from '@signalco/ui-primitives/Skeleton';
import { Stack } from '@signalco/ui-primitives/Stack';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@signalco/ui-primitives/Tabs';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useEffect, useState } from 'react';
import type { useCheckout } from '../../hooks/useCheckout';
import { useDeliveryAddresses } from '../../hooks/useDeliveryAddresses';
import { usePickupLocations } from '../../hooks/usePickupLocations';
import { useShoppingCart } from '../../hooks/useShoppingCart';
import { type TimeSlotData, useTimeSlots } from '../../hooks/useTimeSlots';
import { ButtonConfirmPayment } from '../../hud/components/shopping-cart/ButtonConfirmPayment';
import { KnownPages } from '../../knownPages';
import {
    AddressCard,
    DeliveryAddressesSection,
} from './DeliveryAddressesSection';

export interface DeliverySelectionData {
    mode: 'delivery' | 'pickup';
    addressId?: number;
    locationId?: number;
    slotId?: number;
    notes?: string;
}

interface DeliveryStepProps {
    onSelectionChange: (selection: DeliverySelectionData | null) => void;
    onBack: () => void;
    onProceed: () => void;
    checkout: ReturnType<typeof useCheckout>;
    isValid: boolean;
}

export function DeliveryStep({
    onSelectionChange,
    onBack,
    checkout,
    onProceed,
    isValid,
}: DeliveryStepProps) {
    const [selection, setSelection] = useState<DeliverySelectionData>({
        mode: 'delivery',
    });
    const [manageAddresses, setManageAddresses] = useState(false);
    const { data: cart } = useShoppingCart();

    const { data: addresses, isLoading: isLoadingAddresses } =
        useDeliveryAddresses();
    const { data: pickupLocations } = usePickupLocations();

    // Get available slots based on current selection
    const { data: timeSlots, isLoading: slotsLoading } = useTimeSlots({
        type: selection.mode,
        locationId:
            selection.mode === 'pickup' ? selection.locationId : undefined,
        from: new Date().toISOString(),
        to: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // Next 14 days
    });

    useEffect(() => {
        if (
            !isLoadingAddresses &&
            addresses &&
            addresses.length > 0 &&
            !selection.addressId
        ) {
            const defaultAddress =
                addresses.find((a) => a.isDefault) || addresses[0];
            setSelection((prev) => ({
                ...prev,
                addressId: defaultAddress.id,
            }));
        }
    }, [addresses, isLoadingAddresses, selection.addressId]);

    // Update parent component when selection changes
    useEffect(() => {
        const isComplete =
            selection.slotId &&
            (selection.mode === 'delivery'
                ? selection.addressId
                : selection.locationId);

        onSelectionChange(isComplete ? selection : null);
    }, [selection, onSelectionChange]);

    const handleModeChange = (mode: 'delivery' | 'pickup') => {
        setSelection({
            mode,
            // Reset mode-specific selections
            addressId: undefined,
            locationId: undefined,
            slotId: undefined,
            notes: selection.notes,
        });
    };

    const handleAddressChange = (addressId: number) => {
        setSelection((prev) => ({ ...prev, addressId, locationId: undefined }));
    };

    const handleLocationChange = (locationId: number) => {
        setSelection((prev) => ({ ...prev, locationId, addressId: undefined }));
    };

    const handleSlotChange = (slotId: number) => {
        setSelection((prev) => ({ ...prev, slotId }));
    };

    const formatSlotTime = (slot: TimeSlotData) => {
        const start = new Date(slot.startAt);
        const end = new Date(slot.endAt);

        const dayOfWeek = start.toLocaleDateString('hr-HR', {
            weekday: 'long',
        });
        const capitalizedDayOfWeek =
            dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1);

        const datePart = start.toLocaleDateString('hr-HR');
        const timePartStart = start.toLocaleTimeString('hr-HR', {
            hour: '2-digit',
            minute: '2-digit',
        });
        const timePartEnd = end.toLocaleTimeString('hr-HR', {
            hour: '2-digit',
            minute: '2-digit',
        });

        return `${capitalizedDayOfWeek}, ${datePart} ${timePartStart} - ${timePartEnd}`;
    };

    if (manageAddresses) {
        return (
            <Stack spacing={4}>
                <Row spacing={1}>
                    <IconButton
                        title="Natrag na dostavu"
                        variant="plain"
                        onClick={() => setManageAddresses(false)}
                    >
                        <Navigate className="size-5 rotate-180 shrink-0" />
                    </IconButton>
                    <Typography level="h3">Upravljanje adresama</Typography>
                </Row>
                <div className="overflow-y-auto max-h-[50vh]">
                    <DeliveryAddressesSection />
                </div>
            </Stack>
        );
    }

    const selectedAddress = addresses?.find(
        (a) => a.id === selection.addressId,
    );

    return (
        <Stack spacing={2}>
            <Typography level="h3">Način dostave</Typography>

            <Alert color="info">
                Tvoja košarica sadrži radnje koje zahtijevaju dostavu ili
                preuzimanje.
            </Alert>

            {/* Mode Selection */}
            <Stack spacing={2}>
                <Tabs
                    value={selection.mode}
                    onValueChange={(value: string) =>
                        handleModeChange(value as 'delivery' | 'pickup')
                    }
                >
                    <TabsList className="grid w-full grid-cols-2 border">
                        <TabsTrigger
                            value="delivery"
                            className="flex items-center gap-2"
                        >
                            <Truck className="size-4" />
                            Dostava
                        </TabsTrigger>
                        <TabsTrigger
                            value="pickup"
                            className="flex items-center gap-2"
                        >
                            <ShoppingCart className="size-4" />
                            Preuzimanje
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="delivery" className="mt-4">
                        <Stack spacing={3}>
                            <Stack spacing={2}>
                                <Stack spacing={1}>
                                    <Row spacing={1}>
                                        {isLoadingAddresses ? (
                                            <Skeleton className="h-10 w-full rounded-md" />
                                        ) : addresses &&
                                            addresses.length > 0 ? (
                                            <SelectItems
                                                label="Adresa za dostavu"
                                                placeholder="Odaberi adresu..."
                                                className="w-full"
                                                defaultValue={
                                                    addresses
                                                        .find(
                                                            (a) => a.isDefault,
                                                        )
                                                        ?.id.toString() || ''
                                                }
                                                value={
                                                    selection.addressId?.toString() ||
                                                    ''
                                                }
                                                onValueChange={(
                                                    value: string,
                                                ) =>
                                                    handleAddressChange(
                                                        parseInt(value, 10),
                                                    )
                                                }
                                                items={addresses.map(
                                                    (address) => ({
                                                        label: `${address.label} - ${address.street1}, ${address.city}`,
                                                        value: address.id.toString(),
                                                    }),
                                                )}
                                            />
                                        ) : (
                                            <NoDataPlaceholder className="grow">
                                                Dodajte adresu za dostavu da
                                                biste nastavili s dostavom...
                                            </NoDataPlaceholder>
                                        )}
                                        <Button
                                            variant={
                                                !isLoadingAddresses &&
                                                    !addresses?.length
                                                    ? 'solid'
                                                    : 'outlined'
                                            }
                                            size="sm"
                                            onClick={() =>
                                                setManageAddresses(true)
                                            }
                                            className="h-10 whitespace-nowrap self-end"
                                            startDecorator={
                                                <Edit className="size-4 shrink-0" />
                                            }
                                        >
                                            Moje adrese
                                        </Button>
                                    </Row>
                                </Stack>
                                {/* Show selected address details */}
                                {selectedAddress && (
                                    <AddressCard
                                        address={selectedAddress}
                                        key={selection.addressId}
                                        readonly
                                    />
                                )}
                            </Stack>
                        </Stack>
                    </TabsContent>
                    <TabsContent value="pickup" className="mt-4">
                        <Stack spacing={3}>
                            {pickupLocations && pickupLocations.length > 0 ? (
                                <Stack spacing={2}>
                                    <SelectItems
                                        label="Lokacija dostave"
                                        placeholder="Odaberi lokaciju za preuzimanje..."
                                        value={
                                            selection.locationId?.toString() ||
                                            ''
                                        }
                                        onValueChange={(value: string) =>
                                            handleLocationChange(
                                                parseInt(value, 10),
                                            )
                                        }
                                        items={pickupLocations.map(
                                            (location) => ({
                                                label: `${location.name} - ${location.street1}, ${location.city}`,
                                                value: location.id.toString(),
                                            }),
                                        )}
                                    />
                                    {/* Show selected location details */}
                                    {selection.locationId &&
                                        pickupLocations.map(
                                            (location) =>
                                                selection.locationId ===
                                                location.id && (
                                                    <Card
                                                        key={location.id}
                                                        className="bg-background/50"
                                                    >
                                                        <CardContent className="p-3">
                                                            <Row
                                                                spacing={2}
                                                                justifyContent="space-between"
                                                            >
                                                                <Stack
                                                                    spacing={1}
                                                                >
                                                                    <Typography
                                                                        level="body1"
                                                                        bold
                                                                    >
                                                                        {
                                                                            location.name
                                                                        }
                                                                    </Typography>
                                                                    <Typography
                                                                        level="body3"
                                                                        secondary
                                                                    >
                                                                        {
                                                                            location.street1
                                                                        }
                                                                        {location.street2 &&
                                                                            `, ${location.street2}`}
                                                                        <br />
                                                                        {
                                                                            location.postalCode
                                                                        }{' '}
                                                                        {
                                                                            location.city
                                                                        }
                                                                    </Typography>
                                                                </Stack>
                                                                <a
                                                                    href={
                                                                        KnownPages.GoogleMapsGrediceHQ
                                                                    }
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                >
                                                                    <MapIcon className="size-6 shrink-0" />
                                                                </a>
                                                            </Row>
                                                        </CardContent>
                                                    </Card>
                                                ),
                                        )}
                                </Stack>
                            ) : (
                                <NoDataPlaceholder>
                                    Trenutno nema dostupnih lokacija za
                                    preuzimanje
                                </NoDataPlaceholder>
                            )}
                        </Stack>
                    </TabsContent>
                </Tabs>
            </Stack>

            {/* Time Slot Selection */}
            {(selection.addressId || selection.locationId) && (
                <Stack spacing={3}>
                    {slotsLoading ? (
                        <Typography>Učitavanje termina...</Typography>
                    ) : timeSlots && timeSlots.length > 0 ? (
                        <Stack spacing={2}>
                            <SelectItems
                                label="Termin dostave"
                                placeholder="Odaberi termin dostave..."
                                value={selection.slotId?.toString() || ''}
                                onValueChange={(value: string) =>
                                    handleSlotChange(parseInt(value, 10))
                                }
                                items={timeSlots.map((slot) => ({
                                    label: formatSlotTime(slot),
                                    value: slot.id.toString(),
                                }))}
                            />
                        </Stack>
                    ) : (
                        <NoDataPlaceholder className="mb-4">
                            Trenutno nema dostupnih termina za odabrani način
                            dostave
                        </NoDataPlaceholder>
                    )}
                </Stack>
            )}

            {/* Action Buttons */}
            <Row spacing={2} justifyContent="end">
                <Button variant="outlined" onClick={onBack}>
                    Natrag
                </Button>
                <ButtonConfirmPayment
                    onConfirm={onProceed}
                    checkout={checkout}
                    cart={cart}
                    disabled={!isValid}
                />
            </Row>
        </Stack>
    );
}
