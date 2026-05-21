'use client';

import type {
    SelectEntityType,
    SelectEntityTypeCategory,
} from '@gredice/storage';
import { Button } from '@gredice/ui/Button';
import { Input } from '@gredice/ui/Input';
import { ModalConfirm } from '@gredice/ui/ModalConfirm';
import { SelectItems } from '@gredice/ui/SelectItems';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useState } from 'react';
import { IconPicker } from '../../../../../components/admin/directories/IconPicker';
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
    const [selectedIcon, setSelectedIcon] = useState(entityType.icon ?? '');

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
            <Stack spacing={8}>
                <Stack spacing={2}>
                    <Typography level="h4">Uredi tip zapisa</Typography>
                    <Typography level="body2">
                        Uredite podatke za tip zapisa &quot;{entityType.label}
                        &quot;.
                    </Typography>
                </Stack>

                <form action={updateEntityTypeFromEditPage}>
                    <Stack spacing={8}>
                        <Stack spacing={6}>
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

                            <IconPicker
                                name="icon"
                                value={selectedIcon}
                                onValueChange={setSelectedIcon}
                            />

                            <SelectItems
                                name="categoryId"
                                label="Kategorija"
                                placeholder="Odaberite kategoriju"
                                items={categoryItems}
                                defaultValue={
                                    entityType.categoryId?.toString() || 'none'
                                }
                                helperText="Kategorija pomaže u organizaciji tipova zapisa"
                            />
                            <SelectItems
                                name="isRoot"
                                label="Pozicija u izborniku"
                                items={[
                                    { value: 'true', label: 'Root' },
                                    { value: 'false', label: 'Shadow' },
                                ]}
                                defaultValue={
                                    entityType.isRoot ? 'true' : 'false'
                                }
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
