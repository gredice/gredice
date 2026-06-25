import { getEntityTypeByName } from '@gredice/storage';
import { Card, CardOverflow } from '@gredice/ui/Card';
import { Add } from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import Link from 'next/link';
import { EntityTypeMenu } from '../../../../components/admin/directories';
import { EntitiesList } from '../../../../components/admin/lists';
import {
    AdminDirectoryBreadcrumbs,
    AdminPageHeader,
} from '../../../../components/admin/navigation';
import { FilterProvider } from '../../../../components/admin/providers';
import { SearchInput } from '../../../../components/admin/SearchInput';
import { ServerActionIconButton } from '../../../../components/shared/ServerActionIconButton';
import { auth } from '../../../../lib/auth/auth';
import { KnownPages } from '../../../../src/KnownPages';
import {
    createEntity,
    duplicateEntity,
} from '../../../(actions)/entityActions';
import { defaultDirectoryEntityListSort } from './directoryEntityListConfig';
import {
    getDirectoryEntityListContext,
    listDirectoryEntitiesPageFromContext,
    parseDirectoryEntityOperationIds,
} from './directoryEntityListData';
import { EntitiesFilters } from './EntitiesFilters';

export const dynamic = 'force-dynamic';

export default async function EntitiesPage({
    params,
    searchParams,
}: {
    params: Promise<{ entityType: string }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    await auth(['admin']);
    const { entityType: entityTypeName } = await params;
    const urlParams = await searchParams;
    const completionFilter =
        typeof urlParams.completion === 'string' ? urlParams.completion : '';
    const stateFilter =
        typeof urlParams.state === 'string' ? urlParams.state : '';
    const operationIds = parseDirectoryEntityOperationIds(
        typeof urlParams.operations === 'string'
            ? urlParams.operations
            : undefined,
    );
    const entityType = await getEntityTypeByName(entityTypeName);
    const createEntityBound = createEntity.bind(null, entityTypeName);
    const duplicateEntityBound = duplicateEntity.bind(null, entityTypeName);
    const listContext = await getDirectoryEntityListContext(entityTypeName);
    const initialPage = await listDirectoryEntitiesPageFromContext({
        completion: completionFilter,
        context: listContext,
        entityTypeName,
        operationIds,
        sort: defaultDirectoryEntityListSort,
        state: stateFilter,
    });

    return (
        <FilterProvider>
            <Stack spacing={4}>
                <AdminPageHeader
                    breadcrumbs={
                        <AdminDirectoryBreadcrumbs
                            entityTypeName={entityTypeName}
                            entityTypeLabel={entityType?.label}
                        />
                    }
                    actions={
                        <Row spacing={2}>
                            {listContext.inventoryLinkConfig && (
                                <Link
                                    href={KnownPages.InventoryConfig(
                                        listContext.inventoryLinkConfig.id,
                                    )}
                                >
                                    <Row
                                        spacing={2}
                                        className="text-sm font-medium px-3 py-2 rounded-md border hover:bg-accent transition-colors"
                                    >
                                        <span>Zaliha</span>
                                    </Row>
                                </Link>
                            )}
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
                    }
                    heading={entityType?.label ?? entityTypeName}
                />
                <h1 className="sr-only">
                    {entityType?.label ?? entityTypeName}
                </h1>
                <EntitiesFilters
                    operationOptions={listContext.operationFilterOptions}
                    selectedOperationIds={operationIds}
                />
                <Card>
                    <CardOverflow>
                        <EntitiesList
                            entityTypeName={entityTypeName}
                            attributeDefinitions={
                                listContext.attributeDefinitions
                            }
                            initialPage={initialPage}
                            showInventoryColumn={
                                listContext.showInventoryColumn
                            }
                            inventoryLowCountThreshold={
                                listContext.inventoryLowCountThreshold
                            }
                            completionFilter={completionFilter}
                            stateFilter={stateFilter}
                            operationIds={operationIds}
                            onDuplicate={duplicateEntityBound}
                            refLabelsByDefinitionId={
                                listContext.refLabelsByDefinitionId
                            }
                        />
                    </CardOverflow>
                </Card>
            </Stack>
        </FilterProvider>
    );
}
