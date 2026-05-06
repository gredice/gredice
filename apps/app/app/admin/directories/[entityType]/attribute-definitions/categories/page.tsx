import { getEntityTypeByName } from '@gredice/storage';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { notFound } from 'next/navigation';
import {
    AdminDirectoryBreadcrumbs,
    AdminPageHeader,
} from '../../../../../../components/admin/navigation';
import { KnownPages } from '../../../../../../src/KnownPages';

export default async function EntityTypeAttributeDefinitionCategoriesPage({
    params,
}: PageProps<'/admin/directories/[entityType]/attribute-definitions/categories'>) {
    const { entityType: entityTypeName } = await params;
    const entityType = await getEntityTypeByName(entityTypeName);
    if (!entityType) {
        notFound();
    }

    return (
        <Stack spacing={2}>
            <AdminPageHeader
                breadcrumbs={
                    <AdminDirectoryBreadcrumbs
                        entityTypeName={entityTypeName}
                        entityTypeLabel={entityType.label}
                        items={[
                            {
                                label: 'Atributi',
                                href: KnownPages.DirectoryEntityTypeAttributeDefinitions(
                                    entityTypeName,
                                ),
                            },
                            { label: 'Kategorije' },
                        ]}
                    />
                }
                heading="Kategorije"
            />
            <Stack spacing={2} className="py-8" alignItems="center">
                <Typography level="body2" center>
                    Odaberite zapis ili kreirajte novi.
                </Typography>
            </Stack>
        </Stack>
    );
}
