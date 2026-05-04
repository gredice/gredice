import { getEntityTypeByName } from '@gredice/storage';
import { Breadcrumbs } from '@signalco/ui/Breadcrumbs';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { notFound } from 'next/navigation';
import { AdminPageHeader } from '../../../../../../components/admin/navigation';
import { AdminBreadcrumbLevelSelector } from '../../../../../../components/admin/navigation/AdminBreadcrumbLevelSelector';
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
                    <Breadcrumbs
                        items={[
                            {
                                label: <AdminBreadcrumbLevelSelector />,
                                href: KnownPages.Directories,
                            },
                            {
                                label: entityType.label,
                                href: KnownPages.DirectoryEntityType(
                                    entityTypeName,
                                ),
                            },
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
