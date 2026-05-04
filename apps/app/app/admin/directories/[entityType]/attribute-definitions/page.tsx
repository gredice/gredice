import { getEntityTypeByName } from '@gredice/storage';
import { Breadcrumbs } from '@signalco/ui/Breadcrumbs';
import { Stack } from '@signalco/ui-primitives/Stack';
import { notFound } from 'next/navigation';
import { AttributeDefinitionsList } from '../../../../../components/admin/directories';
import { AdminPageHeader } from '../../../../../components/admin/navigation';
import { AdminBreadcrumbLevelSelector } from '../../../../../components/admin/navigation/AdminBreadcrumbLevelSelector';
import { KnownPages } from '../../../../../src/KnownPages';

export const dynamic = 'force-dynamic';

export default async function AttributesPage({
    params,
}: {
    params: Promise<{ entityType: string }>;
}) {
    const { entityType: entityTypeName } = await params;
    const entityType = await getEntityTypeByName(entityTypeName);
    if (!entityType) {
        return notFound();
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
                            { label: 'Atributi' },
                        ]}
                    />
                }
                heading="Atributi"
            />
            <AttributeDefinitionsList entityTypeName={entityTypeName} />
        </Stack>
    );
}
