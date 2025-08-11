import { useState, useEffect } from 'react';
import { Button } from "@signalco/ui-primitives/Button";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Card, CardContent } from "@signalco/ui-primitives/Card";
import { Row } from "@signalco/ui-primitives/Row";
import { SelectItems } from "@signalco/ui-primitives/SelectItems";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@signalco/ui-primitives/Tabs";
import { Navigate, MapPin, Truck, ShoppingCart, Timer } from "@signalco/ui-icons";
import { Alert } from "@signalco/ui/Alert";
import { NoDataPlaceholder } from "@signalco/ui/NoDataPlaceholder";
import { useDeliveryAddresses, DeliveryAddressData } from "../../hooks/useDeliveryAddresses";
import { usePickupLocations, PickupLocationData } from "../../hooks/usePickupLocations";
import { useTimeSlots, TimeSlotData } from "../../hooks/useTimeSlots";
import { DeliveryAddressesSection } from './DeliveryAddressesSection';

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
    isValid: boolean;
}

export function DeliveryStep({ onSelectionChange, onBack, onProceed, isValid }: DeliveryStepProps) {
    const [selection, setSelection] = useState<DeliverySelectionData>({
        mode: 'delivery'
    });
    const [manageAddresses, setManageAddresses] = useState(false);

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
                <Row justifyContent="space-between" alignItems="center">
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
        <Stack spacing={4}>
            <Row spacing={2} justifyContent="space-between" alignItems="center">
                <Typography level="h3">Informacije o dostavi</Typography>
                <Button
                    variant="plain"
                    onClick={onBack}
                    startDecorator={<Navigate className="size-4 rotate-180" />}
                >
                    Natrag na košaricu
                </Button>
            </Row>

            <Alert color="info">
                Vaša košarica sadrži stavke koje zahtijevaju dostavu ili preuzimanje.
            </Alert>

            {/* Mode Selection */}
            <Card>
                <CardContent>
                    <Stack spacing={3}>
                        <Typography level="h6">Odaberite način dostave</Typography>
                        <Tabs
                            value={selection.mode}
                            onValueChange={(value: string) => handleModeChange(value as 'delivery' | 'pickup')}
                        >
                            <TabsList className="grid w-full grid-cols-2">
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
                                    <Row justifyContent="space-between" alignItems="center">
                                        <Typography level="body1">Odaberite adresu za dostavu</Typography>
                                        <Button
                                            variant="outlined"
                                            size="sm"
                                            onClick={() => setManageAddresses(true)}
                                        >
                                            Upravljaj adresama
                                        </Button>
                                    </Row>

                                    {addresses && addresses.length > 0 ? (
                                        <Stack spacing={2}>
                                            <SelectItems
                                                placeholder="Odaberite adresu"
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
                                                    <Card key={address.id} className="border-primary bg-primary/5">
                                                        <CardContent className="p-3">
                                                            <Stack spacing={1}>
                                                                <Row spacing={2} alignItems="center">
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
                                        <NoDataPlaceholder>
                                            Dodajte adresu za dostavu da biste nastavili
                                        </NoDataPlaceholder>
                                    )}
                                </Stack>
                            </TabsContent>

                            <TabsContent value="pickup" className="mt-4">
                                <Stack spacing={3}>
                                    <Typography level="body1">Odaberite lokaciju za preuzimanje</Typography>

                                    {pickupLocations && pickupLocations.length > 0 ? (
                                        <Stack spacing={2}>
                                            <SelectItems
                                                placeholder="Odaberite lokaciju"
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
                                                    <Card key={location.id} className="border-primary bg-primary/5">
                                                        <CardContent className="p-3">
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
                </CardContent>
            </Card>

            {/* Time Slot Selection */}
            {(selection.addressId || selection.locationId) && (
                <Card>
                    <CardContent>
                        <Stack spacing={3}>
                            <Typography level="h6">Odaberite termin</Typography>

                            {slotsLoading ? (
                                <Typography>Učitavanje termina...</Typography>
                            ) : timeSlots && timeSlots.length > 0 ? (
                                <Stack spacing={2}>
                                    <SelectItems
                                        placeholder="Odaberite termin"
                                        value={selection.slotId?.toString() || ''}
                                        onValueChange={(value: string) => handleSlotChange(parseInt(value))}
                                        items={timeSlots.map(slot => ({
                                            label: formatSlotTime(slot),
                                            value: slot.id.toString()
                                        }))}
                                    />
                                    {/* Show selected slot details */}
                                    {selection.slotId && timeSlots.map((slot) => (
                                        selection.slotId === slot.id && (
                                            <Card key={slot.id} className="border-primary bg-primary/5">
                                                <CardContent className="p-3">
                                                    <Row spacing={2} alignItems="center">
                                                        <Timer className="size-4 text-muted-foreground" />
                                                        <Typography level="body2">
                                                            {formatSlotTime(slot)}
                                                        </Typography>
                                                    </Row>
                                                </CardContent>
                                            </Card>
                                        )
                                    ))}
                                </Stack>
                            ) : (
                                <NoDataPlaceholder>
                                    Trenutno nema dostupnih termina za odabrani način dostave
                                </NoDataPlaceholder>
                            )}
                        </Stack>
                    </CardContent>
                </Card>
            )}

            {/* Action Buttons */}
            <Row spacing={2} justifyContent="end">
                <Button
                    variant="outlined"
                    onClick={onBack}
                >
                    Natrag
                </Button>
                <Button
                    variant="solid"
                    onClick={onProceed}
                    disabled={!isValid}
                    endDecorator={<Navigate className="size-4" />}
                >
                    Nastavi na plaćanje
                </Button>
            </Row>
        </Stack>
    );
}
