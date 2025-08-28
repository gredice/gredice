import { getEntityTypeByName } from '@gredice/storage';
import { Add } from '@signalco/ui-icons';
import { Card, CardOverflow } from '@signalco/ui-primitives/Card';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { EntityTypeMenu } from '../../../../components/admin/directories';
import { EntitiesTable } from '../../../../components/admin/tables';
import { ServerActionIconButton } from '../../../../components/shared/ServerActionIconButton';
import { auth } from '../../../../lib/auth/auth';
import { createEntity } from '../../../(actions)/entityActions';
import { EntitiesSearchInput } from './EntitiesSearchInput';

export const dynamic = 'force-dynamic';

export default async function EntitiesPage({
    params,
    searchParams,
}: {
    params: Promise<{ entityType: string }>;
    searchParams: Promise<{ search?: string }>;
}) {
    await auth(['admin']);
    const { entityType: entityTypeName } = await params;
    const { search = '' } = await searchParams;
    const entityType = await getEntityTypeByName(entityTypeName);
    const createEntityBound = createEntity.bind(null, entityTypeName);

    return (
        <Stack spacing={2}>
            <Row spacing={1} justifyContent="space-between">
                <Row spacing={2} alignItems="center">
                    <Typography level="h1" className="text-2xl" semiBold>
                        {entityType?.label}
                    </Typography>
                    <EntitiesSearchInput />
                </Row>
                <Row>
                    <ServerActionIconButton
                        variant="plain"
                        title="Dodaj zapis"
                        onClick={createEntityBound}
                    >
                        <Add className="size-5" />
                    </ServerActionIconButton>
                    {entityType && <EntityTypeMenu entityType={entityType} />}
                </Row>
            </Row>
            <Card>
                <CardOverflow>
                    <EntitiesTable
                        entityTypeName={entityTypeName}
                        search={search}
                    />
                </CardOverflow>
            </Card>
        </Stack>
    );
}
