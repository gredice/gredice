import { getEntityTypeByName } from '@gredice/storage';
import { Stack } from '@signalco/ui-primitives/Stack';
import { notFound } from 'next/navigation';
import { AttributeDefinitionsList } from '../../../../../components/admin/directories';
import {
    AdminDirectoryBreadcrumbs,
    AdminPageHeader,
} from '../../../../../components/admin/navigation';

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
                    <AdminDirectoryBreadcrumbs
                        entityTypeName={entityTypeName}
                        entityTypeLabel={entityType.label}
                        items={[{ label: 'Atributi' }]}
                    />
                }
                heading="Atributi"
            />
            <AttributeDefinitionsList entityTypeName={entityTypeName} />
        </Stack>
    );
}
