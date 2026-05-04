'use client';

import type { IncomingEntityLinkGroup } from '@gredice/storage';
import { Close, Link as LinkIcon, LoaderSpinner } from '@signalco/ui-icons';
import {
    Card,
    CardHeader,
    CardOverflow,
    CardTitle,
} from '@signalco/ui-primitives/Card';
import { cx } from '@signalco/ui-primitives/cx';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Table } from '@signalco/ui-primitives/Table';
import { Typography } from '@signalco/ui-primitives/Typography';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { KnownPages } from '../../../../../src/KnownPages';
import { getEntityIncomingLinksAction } from '../../../../(actions)/entityActions';

type LoadState =
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'loaded'; links: IncomingEntityLinkGroup[] }
    | { status: 'error'; message: string };

export function EntityLinksPanel({ entityId }: { entityId: number }) {
    const [open, setOpen] = useState(false);
    const [loadState, setLoadState] = useState<LoadState>({ status: 'idle' });
    const hasFetchedRef = useRef(false);

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

    async function fetchLinks() {
        setLoadState({ status: 'loading' });
        try {
            const links = await getEntityIncomingLinksAction(entityId);
            setLoadState({ status: 'loaded', links });
        } catch (error) {
            console.error('Failed to load incoming links', error);
            setLoadState({
                status: 'error',
                message:
                    'Greška pri učitavanju povezanih zapisa. Pokušajte ponovno.',
            });
        }
    }

    function handleOpen() {
        setOpen(true);
        if (!hasFetchedRef.current) {
            hasFetchedRef.current = true;
            void fetchLinks();
        }
    }

    function handleRetry() {
        void fetchLinks();
    }

    return (
        <>
            <IconButton
                variant="plain"
                title="Povezani zapisi"
                onClick={handleOpen}
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
                            <EntityLinksContent
                                state={loadState}
                                onRetry={handleRetry}
                            />
                        </div>
                    </Stack>
                </aside>
            </div>
        </>
    );
}

function EntityLinksContent({
    state,
    onRetry,
}: {
    state: LoadState;
    onRetry: () => void;
}) {
    if (state.status === 'idle' || state.status === 'loading') {
        return (
            <Row spacing={2} className="items-center">
                <LoaderSpinner className="size-4 animate-spin" />
                <Typography secondary>Učitavanje...</Typography>
            </Row>
        );
    }

    if (state.status === 'error') {
        return (
            <Card className="p-4">
                <Stack spacing={2}>
                    <Typography>{state.message}</Typography>
                    <button
                        type="button"
                        onClick={onRetry}
                        className="self-start text-sm text-primary underline"
                    >
                        Pokušaj ponovno
                    </button>
                </Stack>
            </Card>
        );
    }

    if (state.links.length === 0) {
        return (
            <Card className="p-4">
                <Typography secondary>
                    Nema zapisa koji trenutno referenciraju ovaj zapis.
                </Typography>
            </Card>
        );
    }

    return (
        <Stack spacing={2}>
            {state.links.map((group) => (
                <IncomingLinksGroupTable
                    key={group.entityTypeName}
                    group={group}
                />
            ))}
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
            <CardHeader>
                <CardTitle>{group.entityTypeLabel}</CardTitle>
            </CardHeader>
            <CardOverflow>
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
            </CardOverflow>
        </Card>
    );
}
