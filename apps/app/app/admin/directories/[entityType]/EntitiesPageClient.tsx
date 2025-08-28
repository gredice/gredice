'use client';

import type { getEntityTypeByName } from '@gredice/storage';
import { Add } from '@signalco/ui-icons';
import { Card, CardOverflow } from '@signalco/ui-primitives/Card';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useState } from 'react';
import { EntityTypeMenu } from '../../../../components/admin/directories';
import { EntitiesTable } from '../../../../components/admin/tables';
import { ServerActionIconButton } from '../../../../components/shared/ServerActionIconButton';
import { EntitiesSearchInput } from './EntitiesSearchInput';

export function EntitiesPageClient({
    entityTypeName,
    entityType,
    createEntityBound,
}: {
    entityTypeName: string;
    entityType: Awaited<ReturnType<typeof getEntityTypeByName>> | null;
    createEntityBound: () => void;
}) {
    const [search, setSearch] = useState('');

    return (
        <Stack spacing={2}>
            <Row spacing={1} justifyContent="space-between">
                <Row spacing={2} alignItems="center">
                    <Typography level="h1" className="text-2xl" semiBold>
                        {entityType?.label}
                    </Typography>
                    <EntitiesSearchInput value={search} onChange={setSearch} />
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
