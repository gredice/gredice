'use client';

import type { IncomingEntityLinkGroup } from '@gredice/storage';
import { ExternalLink, LoaderSpinner } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import Link from 'next/link';
import { useState } from 'react';
import { KnownPages } from '../../../../../src/KnownPages';
import { getEntityIncomingLinksAction } from '../../../../(actions)/entityActions';
import { EntityDetailsPanelCard } from './EntityDetailsPanelCard';

type LoadState =
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'loaded'; links: IncomingEntityLinkGroup[] }
    | { status: 'error'; message: string };

export function EntityLinksPanel({ entityId }: { entityId: number }) {
    const [loadState, setLoadState] = useState<LoadState>({ status: 'idle' });

    async function loadLinks() {
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

    return (
        <EntityDetailsPanelCard title="Povezani zapisi">
            <div className="space-y-3 px-4 pt-2">
                <EntityLinksContent
                    state={loadState}
                    onLoad={() => {
                        void loadLinks();
                    }}
                />
            </div>
        </EntityDetailsPanelCard>
    );
}

function EntityLinksContent({
    state,
    onLoad,
}: {
    state: LoadState;
    onLoad: () => void;
}) {
    if (state.status === 'idle') {
        return (
            <div className="flex justify-center">
                <Button type="button" size="sm" onClick={onLoad}>
                    Učitaj
                </Button>
            </div>
        );
    }

    if (state.status === 'loading') {
        return (
            <div className="flex items-center gap-2 rounded-md border border-border/70 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                <LoaderSpinner className="size-4 animate-spin" />
                <span>Učitavanje...</span>
            </div>
        );
    }

    if (state.status === 'error') {
        return (
            <div className="space-y-2">
                <p className="text-sm text-muted-foreground">{state.message}</p>
                <div className="flex justify-center">
                    <Button type="button" size="sm" onClick={onLoad}>
                        Ponovno
                    </Button>
                </div>
            </div>
        );
    }

    if (state.links.length === 0) {
        return (
            <p className="rounded-md border border-border/70 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                Nema zapisa koji trenutno referenciraju ovaj zapis.
            </p>
        );
    }

    return (
        <div className="space-y-4">
            {state.links.map((group) => (
                <IncomingLinksGroup key={group.entityTypeName} group={group} />
            ))}
        </div>
    );
}

function IncomingLinksGroup({ group }: { group: IncomingEntityLinkGroup }) {
    return (
        <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
                <h4 className="min-w-0 truncate text-sm font-medium text-foreground">
                    {group.entityTypeLabel}
                </h4>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {group.entities.length}
                </span>
            </div>
            <div className="overflow-hidden rounded-md border border-border/70 bg-background/40">
                {group.entities.map((sourceEntity) => (
                    <Link
                        key={sourceEntity.id}
                        href={KnownPages.DirectoryEntity(
                            group.entityTypeName,
                            sourceEntity.id,
                        )}
                        className="block border-border/70 border-b px-3 py-2 transition-colors last:border-b-0 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        <span className="flex items-start justify-between gap-2">
                            <span className="min-w-0">
                                <span className="block truncate text-sm font-medium text-foreground">
                                    {sourceEntity.displayName}
                                </span>
                                <span className="mt-1 block text-xs leading-snug text-muted-foreground">
                                    {sourceEntity.linkedBy
                                        .map((attribute) => attribute.label)
                                        .join(', ')}
                                </span>
                            </span>
                            <ExternalLink
                                className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                                aria-hidden
                            />
                        </span>
                    </Link>
                ))}
            </div>
        </section>
    );
}
