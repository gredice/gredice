'use client';

import type {
    SelectEntityType,
    SelectEntityTypeCategory,
} from '@gredice/storage';
import { ModalConfirm } from '@signalco/ui/ModalConfirm';
import { Button } from '@signalco/ui-primitives/Button';
import { Input } from '@signalco/ui-primitives/Input';
import { SelectItems } from '@signalco/ui-primitives/SelectItems';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useState } from 'react';
import {
    deleteEntityTypeFromEditPage,
    updateEntityTypeFromEditPage,
} from '../../../../(actions)/entityActions';

interface EntityTypeEditFormProps {
    entityType: SelectEntityType & {
        category: SelectEntityTypeCategory | null;
    };
    categories: SelectEntityTypeCategory[];
}

export function EntityTypeEditForm({
    entityType,
    categories,
}: EntityTypeEditFormProps) {
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const categoryItems = [
        { value: 'none', label: 'Bez kategorije' },
        ...categories.map((category) => ({
            value: category.id.toString(),
            label: category.label,
        })),
    ];

    const handleDelete = async () => {
        const formData = new FormData();
        formData.set('id', entityType.id.toString());
        await deleteEntityTypeFromEditPage(formData);
        setShowDeleteConfirm(false);
    };

    return (
        <div className="max-w-2xl mx-auto p-6">
            <Stack spacing={4}>
                <Stack spacing={1}>
                    <Typography level="h4">Uredi tip zapisa</Typography>
                    <Typography level="body2">
                        Uredite podatke za tip zapisa &quot;{entityType.label}
                        &quot;.
                    </Typography>
                </Stack>

                <form action={updateEntityTypeFromEditPage}>
                    <Stack spacing={4}>
                        <Stack spacing={3}>
                            <input
                                type="hidden"
                                name="id"
                                value={entityType.id}
                            />
                            <input
                                type="hidden"
                                name="originalName"
                                value={entityType.name}
                            />

                            <Input
                                name="name"
                                label="Naziv"
                                defaultValue={entityType.name}
                                required
                                helperText="Naziv se koristi u URL-u i API pozivima"
                            />

                            <Input
                                name="label"
                                label="Labela"
                                defaultValue={entityType.label}
                                required
                                helperText="Labela se prikazuje u korisničkom sučelju"
                            />

                            <SelectItems
                                name="categoryId"
                                label="Kategorija"
                                placeholder="Odaberite kategoriju"
                                items={categoryItems}
                                defaultValue={
                                    entityType.categoryId?.toString() || ''
                                }
                                helperText="Kategorija pomaže u organizaciji tipova zapisa"
                            />
                        </Stack>

                        <Button variant="solid" type="submit">
                            Spremi promjene
                        </Button>
                    </Stack>
                </form>

                <ModalConfirm
                    header="Brisanje tipa zapisa"
                    title="Potvrda brisanja"
                    open={showDeleteConfirm}
                    onOpenChange={setShowDeleteConfirm}
                    onConfirm={handleDelete}
                >
                    <Typography>
                        Jeste li sigurni da želite obrisati tip zapisa{' '}
                        <strong>{entityType.label}</strong>? Ova akcija se ne
                        može poništiti.
                    </Typography>
                </ModalConfirm>

                <Button
                    variant="outlined"
                    color="danger"
                    onClick={() => setShowDeleteConfirm(true)}
                >
                    Obriši tip zapisa
                </Button>
            </Stack>
        </div>
    );
}
