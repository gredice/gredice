import {
    getEntityIncomingLinks,
    getEntityRaw,
    type IncomingEntityLinkGroup,
} from '@gredice/storage';
import { Breadcrumbs } from '@signalco/ui/Breadcrumbs';
import { Card } from '@signalco/ui-primitives/Card';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Table } from '@signalco/ui-primitives/Table';
import { Typography } from '@signalco/ui-primitives/Typography';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AdminBreadcrumbLevelSelector } from '../../../../../../components/admin/navigation/AdminBreadcrumbLevelSelector';
import { entityDisplayName } from '../../../../../../src/entities/entityAttributes';
import { KnownPages } from '../../../../../../src/KnownPages';

export const dynamic = 'force-dynamic';

export default async function EntityLinksPage(props: {
    params: Promise<{ entityType: string; entityId: string }>;
}) {
    const params = await props.params;
    const entityId = parseInt(params.entityId, 10);
    const entity = await getEntityRaw(entityId);

    if (!entity) {
        notFound();
    }
    const incomingLinks = await getEntityIncomingLinks(entityId, entity);

    return (
        <Stack spacing={2}>
            <Breadcrumbs
                items={[
                    {
                        label: <AdminBreadcrumbLevelSelector />,
                        href: KnownPages.Directories,
                    },
                    {
                        label: entity.entityType.label,
                        href: KnownPages.DirectoryEntityType(params.entityType),
                    },
                    {
                        label: entityDisplayName(entity),
                        href: KnownPages.DirectoryEntity(
                            params.entityType,
                            entity.id,
                        ),
                    },
                    { label: 'Povezani zapisi' },
                ]}
            />
            <Typography level="h1" className="text-2xl" semiBold>
                Povezani zapisi za {entityDisplayName(entity)}
            </Typography>
            {incomingLinks.length === 0 ? (
                <Card className="p-4">
                    <Typography secondary>
                        Nema zapisa koji trenutno referenciraju ovaj zapis.
                    </Typography>
                </Card>
            ) : (
                incomingLinks.map((group) => (
                    <IncomingLinksGroupTable
                        key={group.entityTypeName}
                        group={group}
                    />
                ))
            )}
        </Stack>
    );
}

function IncomingLinksGroupTable({
    group,
}: {
    group: IncomingEntityLinkGroup;
}) {
    return (
        <Card className="p-4">
            <Stack spacing={2}>
                <Typography level="h5" semiBold>
                    {group.entityTypeLabel}
                </Typography>
                <Table>
                    <Table.Header>
                        <Table.Row>
                            <Table.Head>Zapis</Table.Head>
                            <Table.Head>Povezani atributi</Table.Head>
                        </Table.Row>
                    </Table.Header>
                    <Table.Body>
                        {group.entities.map((sourceEntity) => (
                            <Table.Row key={sourceEntity.id}>
                                <Table.Cell>
                                    <Link
                                        href={KnownPages.DirectoryEntity(
                                            group.entityTypeName,
                                            sourceEntity.id,
                                        )}
                                    >
                                        <Typography>
                                            {sourceEntity.displayName}
                                        </Typography>
                                    </Link>
                                </Table.Cell>
                                <Table.Cell>
                                    <Typography secondary>
                                        {sourceEntity.linkedBy
                                            .map((attribute) => attribute.label)
                                            .join(', ')}
                                    </Typography>
                                </Table.Cell>
                            </Table.Row>
                        ))}
                    </Table.Body>
                </Table>
            </Stack>
        </Card>
    );
}
