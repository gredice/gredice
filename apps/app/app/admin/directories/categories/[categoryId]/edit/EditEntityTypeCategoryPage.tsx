'use client';

import type { SelectEntityTypeCategory } from '@gredice/storage';
import { Breadcrumbs } from '@signalco/ui/Breadcrumbs';
import { ModalConfirm } from '@signalco/ui/ModalConfirm';
import { Delete } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { Card } from '@signalco/ui-primitives/Card';
import { Input } from '@signalco/ui-primitives/Input';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useState } from 'react';
import { KnownPages } from '../../../../../../src/KnownPages';
import {
    removeEntityTypeCategoryById,
    updateEntityTypeCategoryFromForm,
} from '../../../../../(actions)/entityTypeCategoryActions';

export function EditEntityTypeCategoryPage({
    category,
}: {
    category: SelectEntityTypeCategory;
}) {
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const handleUpdate = updateEntityTypeCategoryFromForm.bind(
        null,
        category.id,
    );

    const handleDelete = async () => {
        await removeEntityTypeCategoryById(category.id);
        setShowDeleteConfirm(false);
    };

    return (
        <Stack spacing={4}>
            <Breadcrumbs
                items={[
                    { label: 'Direktoriji', href: KnownPages.Directories },
                    { label: 'Kategorije', href: KnownPages.Directories },
                    { label: category.label },
                ]}
            />

            <Row spacing={4} justifyContent="space-between" alignItems="start">
                <Stack spacing={2}>
                    <Typography level="h2" className="text-2xl" semiBold>
                        Uredi kategoriju: {category.label}
                    </Typography>
                    <Typography level="body1" secondary>
                        Uredite podatke kategorije tipova zapisa.
                    </Typography>
                </Stack>

                <ModalConfirm
                    header="Brisanje kategorije"
                    title="Potvrda brisanja"
                    open={showDeleteConfirm}
                    onOpenChange={setShowDeleteConfirm}
                    onConfirm={handleDelete}
                >
                    <Typography>
                        Jeste li sigurni da želite obrisati kategoriju{' '}
                        <strong>{category.label}</strong>?
                    </Typography>
                </ModalConfirm>

                <Button
                    variant="plain"
                    color="danger"
                    onClick={() => setShowDeleteConfirm(true)}
                >
                    <Delete className="size-4" />
                    Obriši kategoriju
                </Button>
            </Row>

            <Card className="max-w-2xl">
                <Stack spacing={4} className="p-6">
                    <form action={handleUpdate}>
                        <Stack spacing={4}>
                            <Stack spacing={3}>
                                <Input
                                    name="name"
                                    label="Naziv"
                                    defaultValue={category.name}
                                    required
                                />
                                <Input
                                    name="label"
                                    label="Labela"
                                    defaultValue={category.label}
                                    required
                                />
                            </Stack>
                            <Button
                                variant="solid"
                                type="submit"
                                className="w-fit"
                            >
                                Spremi promjene
                            </Button>
                        </Stack>
                    </form>
                </Stack>
            </Card>
        </Stack>
    );
}