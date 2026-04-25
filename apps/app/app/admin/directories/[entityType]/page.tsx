import {
    getAttributeDefinitions,
    getEntitiesRaw,
    getEntityTypeByName,
} from '@gredice/storage';
import { Breadcrumbs } from '@signalco/ui/Breadcrumbs';
import { Add } from '@signalco/ui-icons';
import { Card, CardOverflow } from '@signalco/ui-primitives/Card';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { EntityTypeMenu } from '../../../../components/admin/directories';
import { AdminBreadcrumbLevelSelector } from '../../../../components/admin/navigation/AdminBreadcrumbLevelSelector';
import { FilterProvider } from '../../../../components/admin/providers';
import { SearchInput } from '../../../../components/admin/SearchInput';
import { EntitiesTable } from '../../../../components/admin/tables';
import { ServerActionIconButton } from '../../../../components/shared/ServerActionIconButton';
import { auth } from '../../../../lib/auth/auth';
import { KnownPages } from '../../../../src/KnownPages';
import {
    createEntity,
    duplicateEntity,
} from '../../../(actions)/entityActions';

export const dynamic = 'force-dynamic';

export default async function EntitiesPage({
    params,
}: {
    params: Promise<{ entityType: string }>;
}) {
    await auth(['admin']);
    const { entityType: entityTypeName } = await params;
    const entityType = await getEntityTypeByName(entityTypeName);
    const createEntityBound = createEntity.bind(null, entityTypeName);
    const duplicateEntityBound = duplicateEntity.bind(null, entityTypeName);
    const [entities, attributeDefinitions] = await Promise.all([
        getEntitiesRaw(entityTypeName),
        getAttributeDefinitions(entityTypeName),
    ]);

    return (
        <FilterProvider>
            <Stack spacing={2}>
                <h1 className="sr-only">
                    {entityType?.label ?? entityTypeName}
                </h1>
                <Row
                    spacing={1}
                    justifyContent="space-between"
                    className="flex-wrap gap-2"
                >
                    <Breadcrumbs
                        items={[
                            {
                                label: <AdminBreadcrumbLevelSelector />,
                                href: KnownPages.Directories,
                            },
                            { label: entityType?.label ?? entityTypeName },
                        ]}
                    />
                    <Row spacing={1}>
                        <SearchInput />
                        <ServerActionIconButton
                            variant="plain"
                            title="Dodaj zapis"
                            onClick={createEntityBound}
                        >
                            <Add className="size-5" />
                        </ServerActionIconButton>
                        {entityType && (
                            <EntityTypeMenu entityType={entityType} />
                        )}
                    </Row>
                </Row>
                <Card>
                    <CardOverflow>
                        <EntitiesTable
                            entityTypeName={entityTypeName}
                            entities={entities}
                            attributeDefinitions={attributeDefinitions}
                            onDuplicate={duplicateEntityBound}
                        />
                    </CardOverflow>
                </Card>
            </Stack>
        </FilterProvider>
    );
}
