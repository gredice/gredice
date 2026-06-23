import {
    getAttributeDefinitions,
    getEntityTypeByNameWithCategory,
    getEntityTypeCategories,
} from '@gredice/storage';
import { Stack } from '@gredice/ui/Stack';
import { notFound } from 'next/navigation';
import {
    AdminDirectoryBreadcrumbs,
    AdminPageHeader,
} from '../../../../../components/admin/navigation';
import { auth } from '../../../../../lib/auth/auth';
import { EntityTypeEditForm } from './EntityTypeEditForm';

export const dynamic = 'force-dynamic';

export default async function EditEntityTypePage({
    params,
}: PageProps<'/admin/directories/[entityType]/edit'>) {
    await auth(['admin']);
    const { entityType: entityTypeName } = await params;

    const entityType = await getEntityTypeByNameWithCategory(entityTypeName);
    if (!entityType) {
        notFound();
    }

    const [categories, attributeDefinitions] = await Promise.all([
        getEntityTypeCategories(),
        getAttributeDefinitions(),
    ]);
    const inventorySourceAttributeOptions = attributeDefinitions
        .filter(
            (definition) =>
                definition.dataType === `ref:${entityTypeName}` &&
                definition.entityTypeName !== entityTypeName,
        )
        .map((definition) => ({
            value: definition.id.toString(),
            label: `${definition.entityType.label} / ${
                definition.categoryDefinition?.label ?? definition.category
            } / ${definition.label}`,
        }));

    return (
        <Stack spacing={8}>
            <AdminPageHeader
                breadcrumbs={
                    <AdminDirectoryBreadcrumbs
                        entityTypeName={entityTypeName}
                        entityTypeLabel={entityType.label}
                        items={[{ label: 'Uredi' }]}
                    />
                }
                heading={`Uredi ${entityType.label}`}
            />
            <EntityTypeEditForm
                entityType={entityType}
                categories={categories}
                inventorySourceAttributeOptions={
                    inventorySourceAttributeOptions
                }
            />
        </Stack>
    );
}
