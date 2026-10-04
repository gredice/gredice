'use client';

import type { SelectEntityTypeCategory } from '@gredice/storage';
import { Button } from '@gredice/ui/Button';
import { Card } from '@gredice/ui/Card';
import { Delete } from '@gredice/ui/icons';
import { ModalConfirm } from '@gredice/ui/ModalConfirm';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useState } from 'react';
import {
    AdminDirectoryBreadcrumbs,
    AdminPageHeader,
} from '../../../../../../components/admin/navigation';
import {
    removeEntityTypeCategoryById,
    updateEntityTypeCategoryFromForm,
} from '../../../../../(actions)/entityTypeCategoryActions';
import { EntityTypeCategoryFormFields } from '../../EntityTypeCategoryFormFields';

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
        <Stack spacing={8}>
            <AdminPageHeader
                breadcrumbs={
                    <AdminDirectoryBreadcrumbs
                        items={[
                            { label: 'Kategorije' },
                            { label: category.label },
                        ]}
                    />
                }
                actions={
                    <Button
                        variant="plain"
                        color="danger"
                        onClick={() => setShowDeleteConfirm(true)}
                    >
                        <Delete className="size-4" />
                        Obriši kategoriju
                    </Button>
                }
                heading={`Uredi kategoriju: ${category.label}`}
            />

            <Row spacing={8} alignItems="start">
                <Stack spacing={4}>
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
            </Row>

            <Card className="max-w-2xl">
                <Stack spacing={8} className="p-6">
                    <form action={handleUpdate}>
                        <Stack spacing={8}>
                            <EntityTypeCategoryFormFields
                                defaults={{
                                    name: category.name,
                                    label: category.label,
                                    icon: category.icon,
                                }}
                            />
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
