import { getEntityTypeByName } from '@gredice/storage';
import { Breadcrumbs } from '@signalco/ui/Breadcrumbs';
import { Stack } from '@signalco/ui-primitives/Stack';
import { notFound } from 'next/navigation';
import { AttributeDefinitionsList } from '../../../../../components/admin/directories';
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
            <Breadcrumbs
                items={[
                    {
                        label: entityType.label,
                        href: KnownPages.DirectoryEntityType(entityTypeName),
                    },
                    { label: 'Atributi' },
                ]}
            />
            <AttributeDefinitionsList entityTypeName={entityTypeName} />
        </Stack>
    );
}