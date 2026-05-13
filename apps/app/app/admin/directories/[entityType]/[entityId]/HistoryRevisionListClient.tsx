'use client';

import type {
    SelectAttributeDefinition,
    SelectEntityRevision,
} from '@gredice/storage';
import { UserAvatar } from '@gredice/ui/UserAvatar';
import { Button } from '@signalco/ui-primitives/Button';
import { Modal } from '@signalco/ui-primitives/Modal';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { useMemo, useState } from 'react';
import { Field } from '../../../../../components/shared/fields/Field';

const actionLabels: Record<string, string> = {
    created: 'Kreirano',
    updated: 'Ažurirano',
    deleted: 'Obrisano',
    restored: 'Vraćeno',
    imported: 'Uvezeno',
};

function formatAction(action: string): string {
    const normalizedAction = action.split('.').at(-1) ?? action;
    return (
        actionLabels[normalizedAction] ?? normalizedAction.replace(/[_-]/g, ' ')
    );
}

function formatDateTime(value: Date): string {
    return new Intl.DateTimeFormat('hr-HR', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(value);
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

    return (
        <>
            {revisions.map((revision) => {
                const attributeLabel = revision.attributeDefinitionId
                    ? labelsByDefinitionId.get(revision.attributeDefinitionId)
                    : null;
                return (
                    <Field
                        key={revision.id}
                        name={
                            attributeLabel
                                ? `${formatAction(revision.action)} • ${attributeLabel}`
                                : formatAction(revision.action)
                        }
                        value={
                            <Row
                                className="items-center justify-between"
                                spacing={2}
                            >
                                <Row className="items-center" spacing={2}>
                                    <UserAvatar
                                        avatarUrl={null}
                                        userName={
                                            revision.actorName ??
                                            'Nepoznat korisnik'
                                        }
                                        className="size-6"
                                    />
                                    <span>
                                        {formatDateTime(revision.createdAt)}
                                    </span>
                                </Row>
                                <Button
                                    variant="outlined"
                                    size="sm"
                                    onClick={() =>
                                        setSelectedRevision(revision)
                                    }
                                >
                                    Prikaži promjenu
                                </Button>
                            </Row>
                        }
                    />
                );
            })}

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
                            <Row className="grid grid-cols-2 gap-4">
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
                            </Row>
                        </Stack>
                    </div>
                )}
            </Modal>
        </>
    );
}
