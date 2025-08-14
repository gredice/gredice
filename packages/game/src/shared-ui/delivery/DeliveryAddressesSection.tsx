import { useState } from 'react';
import { Button } from "@signalco/ui-primitives/Button";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Card, CardContent } from "@signalco/ui-primitives/Card";
import { Input } from "@signalco/ui-primitives/Input";
import { Row } from "@signalco/ui-primitives/Row";
import { IconButton } from "@signalco/ui-primitives/IconButton";
import { Modal } from "@signalco/ui-primitives/Modal";
import { ModalConfirm } from "@signalco/ui/ModalConfirm";
import { Checkbox } from "@signalco/ui-primitives/Checkbox";
import { Delete, Edit, MapPin, Add } from "@signalco/ui-icons";
import { NoDataPlaceholder } from "@signalco/ui/NoDataPlaceholder";
import { useDeliveryAddresses, DeliveryAddressData } from "../../hooks/useDeliveryAddresses";
import {
    useCreateDeliveryAddress,
    useUpdateDeliveryAddress,
    useDeleteDeliveryAddress
} from "../../hooks/useDeliveryAddressMutations";

interface AddressFormData {
    label: string;
    contactName: string;
    phone: string;
    street1: string;
    street2: string;
    city: string;
    postalCode: string;
    countryCode: string;
    isDefault: boolean;
}

const initialFormData: AddressFormData = {
    label: '',
    contactName: '',
    phone: '',
    street1: '',
    street2: '',
    city: '',
    postalCode: '',
    countryCode: 'HR',
    isDefault: false
};

function AddressForm({
    address,
    onSubmit,
    onCancel,
    isLoading
}: {
    address?: DeliveryAddressData;
    onSubmit: (data: AddressFormData) => void;
    onCancel: () => void;
    isLoading: boolean;
}) {
    const [formData, setFormData] = useState<AddressFormData>(
        address ? {
            label: address.label,
            contactName: address.contactName,
            phone: address.phone,
            street1: address.street1,
            street2: address.street2 || '',
            city: address.city,
            postalCode: address.postalCode,
            countryCode: address.countryCode,
            isDefault: address.isDefault
        } : initialFormData
    );

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(formData);
    };

    return (
        <form onSubmit={handleSubmit}>
            <Stack spacing={4}>
                <Stack spacing={2}>
                    <Input
                        label="Naziv adrese"
                        value={formData.label}
                        onChange={(e) => setFormData(prev => ({ ...prev, label: e.target.value }))}
                        placeholder="npr. Kuća, Posao..."
                        required
                    />
                    <Input
                        label="Ime i prezime"
                        value={formData.contactName}
                        onChange={(e) => setFormData(prev => ({ ...prev, contactName: e.target.value }))}
                        placeholder="Unesite ime i prezime"
                        required
                    />
                    <Input
                        label="Telefon"
                        value={formData.phone}
                        onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="npr. +385 98 123 4567"
                        required
                    />
                    <Input
                        label="Ulica i kućni broj"
                        value={formData.street1}
                        onChange={(e) => setFormData(prev => ({ ...prev, street1: e.target.value }))}
                        placeholder="Unesite adresu"
                        required
                    />
                    <Input
                        label="Dodatne informacije (stan, kat...)"
                        value={formData.street2}
                        onChange={(e) => setFormData(prev => ({ ...prev, street2: e.target.value }))}
                        placeholder="Dodatne informacije (opciono)"
                    />
                    <Row spacing={2}>
                        <Input
                            label="Grad"
                            value={formData.city}
                            onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                            placeholder="Unesite grad"
                            required
                        />
                        <Input
                            label="Poštanski broj"
                            value={formData.postalCode}
                            onChange={(e) => setFormData(prev => ({ ...prev, postalCode: e.target.value }))}
                            placeholder="10000"
                            required
                        />
                    </Row>
                    <Checkbox
                        checked={formData.isDefault}
                        onCheckedChange={(checked: boolean) => setFormData(prev => ({ ...prev, isDefault: !!checked }))}
                        label="Postavi kao zadanu adresu"
                    />
                </Stack>
                <Row spacing={2} justifyContent="end">
                    <Button
                        type="button"
                        variant="outlined"
                        onClick={onCancel}
                        disabled={isLoading}
                    >
                        Odustani
                    </Button>
                    <Button
                        type="submit"
                        variant="solid"
                        loading={isLoading}
                    >
                        {address ? 'Ažuriraj' : 'Dodaj'} adresu
                    </Button>
                </Row>
            </Stack>
        </form>
    );
}

function AddressCard({ address }: { address: DeliveryAddressData }) {
    const [isEditing, setIsEditing] = useState(false);
    const updateAddress = useUpdateDeliveryAddress();
    const deleteAddress = useDeleteDeliveryAddress();

    const handleUpdate = async (data: AddressFormData) => {
        try {
            await updateAddress.mutateAsync({
                id: address.id,
                ...data
            });
            setIsEditing(false);
        } catch (error) {
            console.error('Failed to update address:', error);
        }
    };

    const handleDelete = async () => {
        try {
            await deleteAddress.mutateAsync(address.id);
        } catch (error) {
            console.error('Failed to delete address:', error);
        }
    };

    if (isEditing) {
        return (
            <Card>
                <CardContent>
                    <AddressForm
                        address={address}
                        onSubmit={handleUpdate}
                        onCancel={() => setIsEditing(false)}
                        isLoading={updateAddress.isPending}
                    />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className={address.isDefault ? 'border-primary' : ''}>
            <CardContent>
                <Stack spacing={2}>
                    <Row justifyContent="space-between" alignItems="start">
                        <Stack spacing={1}>
                            <Row spacing={1}>
                                <Typography level="h6">{address.label}</Typography>
                                {address.isDefault && (
                                    <Typography level="body3" className="text-primary">
                                        (Zadana)
                                    </Typography>
                                )}
                            </Row>
                            <Typography level="body2">{address.contactName}</Typography>
                            <Typography level="body3" secondary>{address.phone}</Typography>
                        </Stack>
                        <Row spacing={1}>
                            <IconButton
                                title="Uredi adresu"
                                variant="outlined"
                                size="sm"
                                onClick={() => setIsEditing(true)}
                            >
                                <Edit className="size-4" />
                            </IconButton>
                            <ModalConfirm
                                title="Potvrdi brisanje adrese"
                                header="Brisanje adrese"
                                onConfirm={handleDelete}
                                trigger={
                                    <IconButton
                                        title="Obriši adresu"
                                        variant="outlined"
                                        size="sm"
                                        className="text-red-600"
                                        loading={deleteAddress.isPending}
                                    >
                                        <Delete className="size-4" />
                                    </IconButton>
                                }
                            >
                                <Typography>
                                    Jeste li sigurni da želite obrisati adresu "{address.label}"?
                                </Typography>
                            </ModalConfirm>
                        </Row>
                    </Row>
                    <Stack spacing={0.5}>
                        <Typography level="body3" secondary>
                            {address.street1}
                            {address.street2 && `, ${address.street2}`}
                        </Typography>
                        <Typography level="body3" secondary>
                            {address.postalCode} {address.city}
                        </Typography>
                    </Stack>
                </Stack>
            </CardContent>
        </Card>
    );
}

export function DeliveryAddressesSection() {
    const { data: addresses, isLoading } = useDeliveryAddresses();
    const [isCreating, setIsCreating] = useState(false);
    const createAddress = useCreateDeliveryAddress();

    const handleCreate = async (data: AddressFormData) => {
        try {
            await createAddress.mutateAsync(data);
            setIsCreating(false);
        } catch (error) {
            console.error('Failed to create address:', error);
        }
    };

    return (
        <Stack spacing={4}>
            <Row justifyContent="space-between">
                <Typography level="h4" className="hidden md:block">Adrese za dostavu</Typography>
                <Modal
                    open={isCreating}
                    onOpenChange={setIsCreating}
                    title="Dodaj novu adresu"
                    trigger={
                        <Button
                            variant="solid"
                            startDecorator={<Add className="size-4" />}
                        >
                            Dodaj adresu
                        </Button>
                    }
                >
                    <AddressForm
                        onSubmit={handleCreate}
                        onCancel={() => setIsCreating(false)}
                        isLoading={createAddress.isPending}
                    />
                </Modal>
            </Row>

            {isLoading ? (
                <Typography>Učitavanje adresa...</Typography>
            ) : addresses && addresses.length > 0 ? (
                <Stack spacing={2}>
                    {addresses.map((address) => (
                        <AddressCard key={address.id} address={address} />
                    ))}
                </Stack>
            ) : (
                <NoDataPlaceholder>
                    Dodajte svoju prvu adresu za dostavu
                </NoDataPlaceholder>
            )}
        </Stack>
    );
}
