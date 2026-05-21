'use client';

import type {
    SelectAttributeDefinition,
    SelectEntityRevision,
} from '@gredice/storage';
import { UserAvatar } from '@gredice/ui/UserAvatar';
import { Down } from '@signalco/ui-icons';
import { cx } from '@signalco/ui-primitives/cx';
import { Modal } from '@signalco/ui-primitives/Modal';
import { Stack } from '@signalco/ui-primitives/Stack';
import { useMemo, useState } from 'react';

const actionLabels: Record<string, string> = {
    created: 'Kreirano',
    updated: 'Ažurirano',
    deleted: 'Obrisano',
    restored: 'Vraćeno',
    imported: 'Uvezeno',
};

type TimelineRevision = {
    revision: SelectEntityRevision;
    actionLabel: string;
    attributeLabel: string | null;
    actorName: string;
};

type TimelineGroup = {
    key: string;
    date: Date;
    revisions: TimelineRevision[];
};

function formatAction(action: string): string {
    const normalizedAction = action.split('.').at(-1) ?? action;
    return (
        actionLabels[normalizedAction] ?? normalizedAction.replace(/[_-]/g, ' ')
    );
}

function formatDate(value: Date): string {
    return new Intl.DateTimeFormat('hr-HR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    }).format(value);
}

function formatTime(value: Date): string {
    return new Intl.DateTimeFormat('hr-HR', {
        hour: '2-digit',
        minute: '2-digit',
    }).format(value);
}

function dayKey(value: Date): string {
    return [
        value.getFullYear(),
        String(value.getMonth() + 1).padStart(2, '0'),
        String(value.getDate()).padStart(2, '0'),
    ].join('-');
}

function formatRevisionCount(count: number): string {
    if (count === 1) {
        return '1 promjena';
    }

    if (count >= 2 && count <= 4) {
        return `${count} promjene`;
    }

    return `${count} promjena`;
}

function revisionTitle(revision: TimelineRevision): string {
    return revision.attributeLabel
        ? `${revision.actionLabel} • ${revision.attributeLabel}`
        : revision.actionLabel;
}

function actorNamesForGroup(revisions: TimelineRevision[]): string[] {
    const names: string[] = [];
    const seenNames = new Set<string>();

    for (const revision of revisions) {
        if (seenNames.has(revision.actorName)) {
            continue;
        }

        seenNames.add(revision.actorName);
        names.push(revision.actorName);
    }

    return names;
}

function buildTimelineGroups(
    revisions: SelectEntityRevision[],
    labelsByDefinitionId: Map<number, string>,
): TimelineGroup[] {
    const groups: TimelineGroup[] = [];
    const groupsByKey = new Map<string, TimelineGroup>();

    for (const revision of revisions) {
        const key = dayKey(revision.createdAt);
        const attributeLabel = revision.attributeDefinitionId
            ? (labelsByDefinitionId.get(revision.attributeDefinitionId) ?? null)
            : null;
        const item: TimelineRevision = {
            revision,
            actionLabel: formatAction(revision.action),
            attributeLabel,
            actorName: revision.actorName?.trim() || 'Nepoznat korisnik',
        };
        const existingGroup = groupsByKey.get(key);

        if (existingGroup) {
            existingGroup.revisions.push(item);
            continue;
        }

        const group = {
            key,
            date: revision.createdAt,
            revisions: [item],
        };
        groupsByKey.set(key, group);
        groups.push(group);
    }

    return groups;
}

export function HistoryRevisionListClient({
    revisions,
    attributeDefinitions,
}: {
    revisions: SelectEntityRevision[];
    attributeDefinitions: SelectAttributeDefinition[];
}) {
    const [selectedRevision, setSelectedRevision] =
        useState<SelectEntityRevision | null>(null);

    const labelsByDefinitionId = useMemo(
        () =>
            new Map(
                attributeDefinitions.map((definition) => [
                    definition.id,
                    definition.label,
                ]),
            ),
        [attributeDefinitions],
    );
    const timelineGroups = useMemo(
        () => buildTimelineGroups(revisions, labelsByDefinitionId),
        [labelsByDefinitionId, revisions],
    );
    const [expandedGroupKeys, setExpandedGroupKeys] = useState<Set<string>>(
        () => new Set(),
    );

    function toggleGroup(key: string) {
        setExpandedGroupKeys((current) => {
            const next = new Set(current);

            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }

            return next;
        });
    }

    return (
        <>
            <div className="max-w-4xl space-y-2">
                {timelineGroups.map((group, groupIndex) => {
                    const expanded = expandedGroupKeys.has(group.key);
                    const contentId = `history-${group.key}`;
                    const actorNames = actorNamesForGroup(group.revisions);
                    const visibleActorNames = actorNames.slice(0, 4);
                    const hiddenActorCount =
                        actorNames.length - visibleActorNames.length;

                    return (
                        <section key={group.key} className="relative pl-8">
                            {groupIndex < timelineGroups.length - 1 && (
                                <span
                                    className="absolute left-2.5 top-6 h-[calc(100%+0.75rem)] w-px bg-border"
                                    aria-hidden
                                />
                            )}
                            <span
                                className="absolute left-1 top-4 size-3 rounded-full border border-primary/70 bg-background ring-4 ring-background"
                                aria-hidden
                            />
                            <div className="space-y-1">
                                <button
                                    type="button"
                                    className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    aria-expanded={expanded}
                                    aria-controls={contentId}
                                    onClick={() => toggleGroup(group.key)}
                                >
                                    <span className="min-w-0">
                                        <span className="flex min-w-0 flex-wrap items-center gap-2">
                                            <span className="text-sm font-medium text-foreground">
                                                {formatDate(group.date)}
                                            </span>
                                            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                                {formatRevisionCount(
                                                    group.revisions.length,
                                                )}
                                            </span>
                                        </span>
                                    </span>
                                    <span className="flex shrink-0 items-center gap-2">
                                        <span className="sr-only">
                                            Doprinositelji:{' '}
                                            {actorNames.join(', ')}
                                        </span>
                                        <span
                                            className="flex items-center -space-x-2"
                                            title={actorNames.join(', ')}
                                            aria-hidden
                                        >
                                            {visibleActorNames.map(
                                                (actorName) => (
                                                    <span
                                                        key={actorName}
                                                        className="block size-6 overflow-hidden rounded-full ring-2 ring-background"
                                                    >
                                                        <UserAvatar
                                                            avatarUrl={null}
                                                            displayName={
                                                                actorName
                                                            }
                                                            size="sm"
                                                            className="rounded-full"
                                                        />
                                                    </span>
                                                ),
                                            )}
                                            {hiddenActorCount > 0 && (
                                                <span className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-[10px] font-medium text-muted-foreground ring-2 ring-background">
                                                    +{hiddenActorCount}
                                                </span>
                                            )}
                                        </span>
                                        <Down
                                            className={cx(
                                                'size-4 shrink-0 text-muted-foreground transition-transform',
                                                expanded ? '' : '-rotate-90',
                                            )}
                                            aria-hidden
                                        />
                                    </span>
                                </button>
                                <div
                                    id={contentId}
                                    hidden={!expanded}
                                    className="space-y-1 py-1"
                                >
                                    {group.revisions.map((revision) => (
                                        <button
                                            key={revision.revision.id}
                                            type="button"
                                            className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                            onClick={() =>
                                                setSelectedRevision(
                                                    revision.revision,
                                                )
                                            }
                                        >
                                            <UserAvatar
                                                avatarUrl={null}
                                                displayName={revision.actorName}
                                                size="sm"
                                                className="shrink-0"
                                            />
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-sm font-medium text-foreground">
                                                    {revisionTitle(revision)}
                                                </span>
                                                <span className="block truncate text-xs text-muted-foreground">
                                                    {revision.actorName}
                                                </span>
                                            </span>
                                            <time
                                                dateTime={revision.revision.createdAt.toISOString()}
                                                className="shrink-0 text-xs text-muted-foreground"
                                            >
                                                {formatTime(
                                                    revision.revision.createdAt,
                                                )}
                                            </time>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </section>
                    );
                })}
            </div>

            <Modal
                open={Boolean(selectedRevision)}
                title="Sadržaj promjene"
                onOpenChange={(open) => {
                    if (!open) {
                        setSelectedRevision(null);
                    }
                }}
            >
                {selectedRevision && (
                    <div className="p-4">
                        <Stack spacing={3}>
                            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                <Stack spacing={1}>
                                    <h4 className="font-medium">Original</h4>
                                    <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-md border p-3 text-xs">
                                        {selectedRevision.previousValue ??
                                            selectedRevision.previousState ??
                                            '-'}
                                    </pre>
                                </Stack>
                                <Stack spacing={1}>
                                    <h4 className="font-medium">Novo</h4>
                                    <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-md border p-3 text-xs">
                                        {selectedRevision.nextValue ??
                                            selectedRevision.nextState ??
                                            '-'}
                                    </pre>
                                </Stack>
                            </div>
                        </Stack>
                    </div>
                )}
            </Modal>
        </>
    );
}
