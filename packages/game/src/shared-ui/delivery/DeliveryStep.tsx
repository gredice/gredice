import { useState, useEffect } from 'react';
import { Button } from "@signalco/ui-primitives/Button";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Card, CardContent } from "@signalco/ui-primitives/Card";
import { Row } from "@signalco/ui-primitives/Row";
import { SelectItems } from "@signalco/ui-primitives/SelectItems";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@signalco/ui-primitives/Tabs";
import { Navigate, Truck, ShoppingCart, Timer, Edit, Map } from "@signalco/ui-icons";
import { Alert } from "@signalco/ui/Alert";
import { NoDataPlaceholder } from "@signalco/ui/NoDataPlaceholder";
import { useDeliveryAddresses } from "../../hooks/useDeliveryAddresses";
import { usePickupLocations } from "../../hooks/usePickupLocations";
import { useTimeSlots, TimeSlotData } from "../../hooks/useTimeSlots";
import { DeliveryAddressesSection } from './DeliveryAddressesSection';
import Link from 'next/link';
import { KnownPages } from '../../knownPages';
import { useCheckout } from '../../hooks/useCheckout';
import { ButtonConfirmPayment } from '../../hud/components/shopping-cart/ButtonConfirmPayment';
import { useShoppingCart } from '../../hooks/useShoppingCart';

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

export function DeliveryStep({ onSelectionChange, onBack, checkout, onProceed, isValid }: DeliveryStepProps) {
    const [selection, setSelection] = useState<DeliverySelectionData>({
        mode: 'delivery'
    });
    const [manageAddresses, setManageAddresses] = useState(false);
    const { data: cart } = useShoppingCart();

    const { data: addresses } = useDeliveryAddresses();
    const { data: pickupLocations } = usePickupLocations();

    // Get available slots based on current selection
    const { data: timeSlots, isLoading: slotsLoading } = useTimeSlots({
        type: selection.mode,
        locationId: selection.mode === 'pickup' ? selection.locationId : undefined,
        from: new Date().toISOString(),
        to: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() // Next 14 days
    });

    // Update parent component when selection changes
    useEffect(() => {
        const isComplete = selection.slotId &&
            (selection.mode === 'delivery' ? selection.addressId : selection.locationId);

        onSelectionChange(isComplete ? selection : null);
    }, [selection, onSelectionChange]);

    const handleModeChange = (mode: 'delivery' | 'pickup') => {
        setSelection({
            mode,
            // Reset mode-specific selections
            addressId: undefined,
            locationId: undefined,
            slotId: undefined,
            notes: selection.notes
        });
    };

    const handleAddressChange = (addressId: number) => {
        setSelection(prev => ({ ...prev, addressId, locationId: undefined }));
    };

    const handleLocationChange = (locationId: number) => {
        setSelection(prev => ({ ...prev, locationId, addressId: undefined }));
    };

    const handleSlotChange = (slotId: number) => {
        setSelection(prev => ({ ...prev, slotId }));
    };

    const formatSlotTime = (slot: TimeSlotData) => {
        const start = new Date(slot.startAt);
        const end = new Date(slot.endAt);
        return `${start.toLocaleDateString('hr-HR')} ${start.toLocaleTimeString('hr-HR', {
            hour: '2-digit',
            minute: '2-digit'
        })} - ${end.toLocaleTimeString('hr-HR', {
            hour: '2-digit',
            minute: '2-digit'
        })}`;
    };

    if (manageAddresses) {
        return (
            <Stack spacing={4}>
                <Row justifyContent="space-between">
                    <Typography level="h3">Upravljanje adresama</Typography>
                    <Button
                        variant="outlined"
                        onClick={() => setManageAddresses(false)}
                    >
                        Natrag na dostavu
                    </Button>
                </Row>
                <DeliveryAddressesSection />
            </Stack>
        );
    }

    return (
        <Stack spacing={2}>
            <Typography level="h3">Informacije o dostavi</Typography>

            <Alert color="info">
                Tvoja košarica sadrži radnje koje zahtijevaju dostavu ili preuzimanje.
            </Alert>

            {/* Mode Selection */}
            <Stack spacing={2}>
                <Typography level="h6">Odaberi način dostave</Typography>
                <Tabs
                    value={selection.mode}
                    onValueChange={(value: string) => handleModeChange(value as 'delivery' | 'pickup')}
                >
                    <TabsList className="grid w-full grid-cols-2 border">
                        <TabsTrigger value="delivery" className="flex items-center gap-2">
                            <Truck className="size-4" />
                            Dostava
                        </TabsTrigger>
                        <TabsTrigger value="pickup" className="flex items-center gap-2">
                            <ShoppingCart className="size-4" />
                            Preuzimanje
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="delivery" className="mt-4">
                        <Stack spacing={3}>
                            <Row justifyContent="space-between">
                                <Typography level="body1">Odaberi adresu za dostavu</Typography>
                                <Button
                                    variant="soft"
                                    size="sm"
                                    onClick={() => setManageAddresses(true)}
                                    startDecorator={<Edit className="size-4 shrink-0" />}
                                >
                                    Moje adrese
                                </Button>
                            </Row>

                            {addresses && addresses.length > 0 ? (
                                <Stack spacing={2}>
                                    <SelectItems
                                        placeholder="Odaberi adresu"
                                        value={selection.addressId?.toString() || ''}
                                        onValueChange={(value: string) => handleAddressChange(parseInt(value))}
                                        items={addresses.map(address => ({
                                            label: `${address.label} - ${address.street1}, ${address.city}`,
                                            value: address.id.toString()
                                        }))}
                                    />
                                    {/* Show selected address details */}
                                    {selection.addressId && addresses.map((address) => (
                                        selection.addressId === address.id && (
                                            <Card key={address.id} className="bg-background/50">
                                                <CardContent className="p-3">
                                                    <Stack spacing={1}>
                                                        <Row spacing={2}>
                                                            <Typography level="body1" bold>
                                                                {address.label}
                                                            </Typography>
                                                            {address.isDefault && (
                                                                <Typography level="body3" className="text-primary">
                                                                    (Zadana)
                                                                </Typography>
                                                            )}
                                                        </Row>
                                                        <Typography level="body2">
                                                            {address.contactName}
                                                        </Typography>
                                                        <Typography level="body3" secondary>
                                                            {address.street1}
                                                            {address.street2 && `, ${address.street2}`}
                                                            <br />
                                                            {address.postalCode} {address.city}
                                                        </Typography>
                                                    </Stack>
                                                </CardContent>
                                            </Card>
                                        )
                                    ))}
                                </Stack>
                            ) : (
                                <NoDataPlaceholder className='mb-4'>
                                    Dodajte adresu za dostavu da biste nastavili
                                </NoDataPlaceholder>
                            )}
                        </Stack>
                    </TabsContent>

                    <TabsContent value="pickup" className="mt-4">
                        <Stack spacing={3}>
                            {pickupLocations && pickupLocations.length > 0 ? (
                                <Stack spacing={2}>
                                    <SelectItems
                                        label="Lokacija dostave"
                                        placeholder="Odaberi lokaciju za preuzimanje..."
                                        value={selection.locationId?.toString() || ''}
                                        onValueChange={(value: string) => handleLocationChange(parseInt(value))}
                                        items={pickupLocations.map(location => ({
                                            label: `${location.name} - ${location.street1}, ${location.city}`,
                                            value: location.id.toString()
                                        }))}
                                    />
                                    {/* Show selected location details */}
                                    {selection.locationId && pickupLocations.map((location) => (
                                        selection.locationId === location.id && (
                                            <Card key={location.id} className="bg-background/50">
                                                <CardContent className="p-3">
                                                    <Row spacing={2} justifyContent='space-between'>
                                                        <Stack spacing={1}>
                                                            <Typography level="body1" bold>
                                                                {location.name}
                                                            </Typography>
                                                            <Typography level="body3" secondary>
                                                                {location.street1}
                                                                {location.street2 && `, ${location.street2}`}
                                                                <br />
                                                                {location.postalCode} {location.city}
                                                            </Typography>
                                                        </Stack>
                                                        <Link href={KnownPages.GoogleMapsGrediceHQ} target="_blank">
                                                            <Map className="size-6 shrink-0" />
                                                        </Link>
                                                    </Row>
                                                </CardContent>
                                            </Card>
                                        )
                                    ))}
                                </Stack>
                            ) : (
                                <NoDataPlaceholder>
                                    Trenutno nema dostupnih lokacija za preuzimanje
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
                                onValueChange={(value: string) => handleSlotChange(parseInt(value))}
                                items={timeSlots.map(slot => ({
                                    label: formatSlotTime(slot),
                                    value: slot.id.toString()
                                }))}
                            />
                        </Stack>
                    ) : (
                        <NoDataPlaceholder className='mb-4'>
                            Trenutno nema dostupnih termina za odabrani način dostave
                        </NoDataPlaceholder>
                    )}
                </Stack>
            )}

            {/* Action Buttons */}
            <Row spacing={2} justifyContent="end">
                <Button
                    variant="outlined"
                    onClick={onBack}
                >
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
