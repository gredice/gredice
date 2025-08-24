import {
    getAttributeDefinitionCategories,
    getEntityTypeByName,
} from '@gredice/storage';
import { Breadcrumbs } from '@signalco/ui/Breadcrumbs';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { notFound } from 'next/navigation';
import { KnownPages } from '../../../../../../../src/KnownPages';
import { FormInput } from './Form';

export default async function AttributeDefinitionCategoryDetailsPage({
    params,
}: {
    params: Promise<{ entityType: string; id: string }>;
}) {
    const { entityType: entityTypeName, id: idString } = await params;
    const id = parseInt(idString, 10);
    if (Number.isNaN(id) || id < 0) {
        notFound();
    }

    const entityType = await getEntityTypeByName(entityTypeName);
    const categories = await getAttributeDefinitionCategories(entityTypeName);
    const category = categories.find((c) => c.id === id);
    if (!category || !entityType) {
        notFound();
    }

    const { name, label } = category;

    return (
        <Stack spacing={2}>
            <Breadcrumbs
                items={[
                    {
                        label: entityType.label,
                        href: KnownPages.DirectoryEntityType(entityTypeName),
                    },
                    {
                        label: 'Atributi',
                        href: KnownPages.DirectoryEntityTypeAttributeDefinitions(
                            entityTypeName,
                        ),
                    },
                    { label: 'Kategorije' },
                    { label: label },
                ]}
            />
            <form>
                <Row spacing={2}>
                    <FormInput
                        category={category}
                        name="label"
                        label="Naziv"
                        value={label}
                    />
                    <FormInput
                        category={category}
                        name="name"
                        label="Oznaka"
                        value={name}
                    />
                </Row>
            </form>
        </Stack>
    );
}