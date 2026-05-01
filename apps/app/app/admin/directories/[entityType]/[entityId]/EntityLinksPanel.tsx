'use client';

import type { IncomingEntityLinkGroup } from '@gredice/storage';
import { Close, Link as LinkIcon } from '@signalco/ui-icons';
import { Card } from '@signalco/ui-primitives/Card';
import { cx } from '@signalco/ui-primitives/cx';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Table } from '@signalco/ui-primitives/Table';
import { Typography } from '@signalco/ui-primitives/Typography';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { KnownPages } from '../../../../../src/KnownPages';

export function EntityLinksPanel({
    incomingLinks,
}: {
    incomingLinks: IncomingEntityLinkGroup[];
}) {
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (!open) {
            return;
        }
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [open]);

    return (
        <>
            <IconButton
                variant="plain"
                title="Povezani zapisi"
                onClick={() => setOpen(true)}
            >
                <LinkIcon className="size-5" />
            </IconButton>
            <div
                className={cx(
                    'fixed inset-0 z-50 transition-opacity duration-200',
                    open ? 'opacity-100' : 'pointer-events-none opacity-0',
                )}
                aria-hidden={!open}
            >
                <button
                    type="button"
                    aria-label="Zatvori panel"
                    tabIndex={open ? 0 : -1}
                    className="absolute inset-0 bg-background/60 backdrop-blur-sm"
                    onClick={() => setOpen(false)}
                />
                <aside
                    role="dialog"
                    aria-label="Povezani zapisi"
                    className={cx(
                        'absolute right-0 top-0 h-full w-full max-w-md transform border-l bg-background shadow-2xl transition-transform duration-200',
                        open ? 'translate-x-0' : 'translate-x-full',
                    )}
                >
                    <Stack className="h-full">
                        <Row
                            justifyContent="space-between"
                            className="items-center border-b px-4 py-3"
                        >
                            <Typography level="h5" semiBold>
                                Povezani zapisi
                            </Typography>
                            <IconButton
                                variant="plain"
                                title="Zatvori"
                                onClick={() => setOpen(false)}
                            >
                                <Close className="size-5" />
                            </IconButton>
                        </Row>
                        <div className="grow overflow-y-auto p-4">
                            {incomingLinks.length === 0 ? (
                                <Card className="p-4">
                                    <Typography secondary>
                                        Nema zapisa koji trenutno referenciraju
                                        ovaj zapis.
                                    </Typography>
                                </Card>
                            ) : (
                                <Stack spacing={2}>
                                    {incomingLinks.map((group) => (
                                        <IncomingLinksGroupTable
                                            key={group.entityTypeName}
                                            group={group}
                                        />
                                    ))}
                                </Stack>
                            )}
                        </div>
                    </Stack>
                </aside>
            </div>
        </>
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
