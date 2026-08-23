import { Button } from '@gredice/ui/Button';
import { Card, CardContent } from '@gredice/ui/Card';
import { Checkbox } from '@gredice/ui/Checkbox';
import { Chip } from '@gredice/ui/Chip';
import { IconButton } from '@gredice/ui/IconButton';
import { Input } from '@gredice/ui/Input';
import { Add, Delete, Edit } from '@gredice/ui/icons';
import { ModalConfirm } from '@gredice/ui/ModalConfirm';
import { NoDataPlaceholder } from '@gredice/ui/NoDataPlaceholder';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useState } from 'react';
import {
    type DeliveryAddressData,
    useDeliveryAddresses,
} from '../../hooks/useDeliveryAddresses';
import {
    useCreateDeliveryAddress,
    useDeleteDeliveryAddress,
    useUpdateDeliveryAddress,
} from '../../hooks/useDeliveryAddressMutations';
import { GameModal } from '../game-modal';

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
    isDefault: false,
};

function AddressForm({
    address,
    onSubmit,
    onCancel,
    isLoading,
}: {
    address?: DeliveryAddressData;
    onSubmit: (data: AddressFormData) => void;
    onCancel: () => void;
    isLoading: boolean;
}) {
    const [formData, setFormData] = useState<AddressFormData>(
        address
            ? {
                  label: address.label,
                  contactName: address.contactName,
                  phone: address.phone,
                  street1: address.street1,
                  street2: address.street2 || '',
                  city: address.city,
                  postalCode: address.postalCode,
                  countryCode: address.countryCode,
                  isDefault: address.isDefault,
              }
            : initialFormData,
    );

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(formData);
    };

    return (
        <form onSubmit={handleSubmit}>
            <Stack spacing={8}>
                <Stack spacing={4}>
                    <Input
                        label="Naziv adrese"
                        className="bg-card"
                        value={formData.label}
                        onChange={(e) =>
                            setFormData((prev) => ({
                                ...prev,
                                label: e.target.value,
                            }))
                        }
                        placeholder="npr. Kuća, Posao..."
                        required
                    />
                    <Input
                        label="Ime i prezime"
                        className="bg-card"
                        value={formData.contactName}
                        onChange={(e) =>
                            setFormData((prev) => ({
                                ...prev,
                                contactName: e.target.value,
                            }))
                        }
                        placeholder="Unesite ime i prezime"
                        required
                    />
                    <Input
                        label="Telefon"
                        className="bg-card"
                        value={formData.phone}
                        onChange={(e) =>
                            setFormData((prev) => ({
                                ...prev,
                                phone: e.target.value,
                            }))
                        }
                        placeholder="npr. +385 98 123 4567"
                        required
                    />
                    <Input
                        label="Ulica i kućni broj"
                        className="bg-card"
                        value={formData.street1}
                        onChange={(e) =>
                            setFormData((prev) => ({
                                ...prev,
                                street1: e.target.value,
                            }))
                        }
                        placeholder="Unesite adresu"
                        required
                    />
                    <Input
                        label="Dodatne informacije (stan, kat...)"
                        className="bg-card"
                        value={formData.street2}
                        onChange={(e) =>
                            setFormData((prev) => ({
                                ...prev,
                                street2: e.target.value,
                            }))
                        }
                        placeholder="Dodatne informacije (opciono)"
                    />
                    <Row spacing={4}>
                        <Input
                            label="Grad"
                            className="bg-card"
                            value={formData.city}
                            onChange={(e) =>
                                setFormData((prev) => ({
                                    ...prev,
                                    city: e.target.value,
                                }))
                            }
                            placeholder="Unesite grad"
                            required
                        />
                        <Input
                            label="Poštanski broj"
                            className="bg-card"
                            value={formData.postalCode}
                            onChange={(e) =>
                                setFormData((prev) => ({
                                    ...prev,
                                    postalCode: e.target.value,
                                }))
                            }
                            placeholder="10000"
                            required
                        />
                    </Row>
                    <Checkbox
                        checked={formData.isDefault}
                        className="bg-card"
                        onCheckedChange={(checked: boolean) =>
                            setFormData((prev) => ({
                                ...prev,
                                isDefault: !!checked,
                            }))
                        }
                        label="Postavi kao zadanu adresu"
                    />
                </Stack>
                <Row spacing={4} justifyContent="end">
                    <Button
                        type="button"
                        variant="outlined"
                        onClick={onCancel}
                        disabled={isLoading}
                    >
                        Odustani
                    </Button>
                    <Button type="submit" variant="solid" loading={isLoading}>
                        {address ? 'Ažuriraj' : 'Dodaj'} adresu
                    </Button>
                </Row>
            </Stack>
        </form>
    );
}

export function AddressCard({
    address,
    readonly,
}: {
    address: DeliveryAddressData;
    readonly?: boolean;
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [mutationError, setMutationError] = useState<string | null>(null);
    const updateAddress = useUpdateDeliveryAddress();
    const deleteAddress = useDeleteDeliveryAddress();

    const handleUpdate = async (data: AddressFormData) => {
        setMutationError(null);
        try {
            await updateAddress.mutateAsync({
                id: address.id,
                ...data,
            });
            setIsEditing(false);
        } catch (error) {
            setMutationError(
                error instanceof Error
                    ? error.message
                    : 'Adresu nije moguće ažurirati.',
            );
        }
    };

    const handleDelete = async () => {
        setMutationError(null);
        try {
            await deleteAddress.mutateAsync(address.id);
        } catch (error) {
            setMutationError(
                error instanceof Error
                    ? error.message
                    : 'Adresu nije moguće obrisati.',
            );
        }
    };

    if (isEditing) {
        return (
            <Card>
                <CardContent>
                    {mutationError ? (
                        <Typography
                            className="mb-3 text-destructive"
                            level="body2"
                        >
                            {mutationError}
                        </Typography>
                    ) : null}
                    <AddressForm
                        address={address}
                        onSubmit={handleUpdate}
                        onCancel={() => {
                            setMutationError(null);
                            setIsEditing(false);
                        }}
                        isLoading={updateAddress.isPending}
                    />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardContent>
                <Stack spacing={4}>
                    {mutationError ? (
                        <Typography className="text-destructive" level="body2">
                            {mutationError}
                        </Typography>
                    ) : null}
                    <Row justifyContent="space-between" alignItems="start">
                        <Stack spacing={2}>
                            <Row spacing={4}>
                                <Typography level="h6">
                                    {address.label}
                                </Typography>
                                {address.isDefault && (
                                    <Chip className="text-primary">
                                        ⭐ Zadana
                                    </Chip>
                                )}
                            </Row>
                            <Stack>
                                <Typography level="body2">
                                    {address.contactName}
                                </Typography>
                                <Typography level="body3">
                                    {address.phone}
                                </Typography>
                            </Stack>
                        </Stack>
                        {!readonly && (
                            <Row spacing={2}>
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
                                        Jeste li sigurni da želite obrisati
                                        adresu "{address.label}"?
                                    </Typography>
                                </ModalConfirm>
                            </Row>
                        )}
                    </Row>
                    <Stack spacing={1}>
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
                <Typography level="h5">Adrese za dostavu</Typography>
                <GameModal
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
                </GameModal>
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
                    Dodaj svoju prvu adresu za dostavu
                </NoDataPlaceholder>
            )}
        </Stack>
    );
}
