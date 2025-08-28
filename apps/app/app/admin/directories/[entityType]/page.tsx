import { getEntityTypeByName } from '@gredice/storage';
import { auth } from '../../../../lib/auth/auth';
import { createEntity } from '../../../(actions)/entityActions';
import { EntitiesPageClient } from './EntitiesPageClient';

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

    return (
        <EntitiesPageClient
            entityTypeName={entityTypeName}
            entityType={entityType}
            createEntityBound={createEntityBound}
        />
    );
}
