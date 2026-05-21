import { getEntityTypeByName } from '@gredice/storage';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
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
        <Stack spacing={4}>
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
            <Stack spacing={4} className="py-8" alignItems="center">
                <Typography level="body2" center>
                    Odaberite zapis ili kreirajte novi.
                </Typography>
            </Stack>
        </Stack>
    );
}
