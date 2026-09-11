'use client';

import { Spinner } from '@gredice/ui/Spinner';
import { unstable_rethrow } from 'next/navigation';
import { useRef, useState } from 'react';
import type { AdminApprovalTask } from '../../../src/approvalTasks';
import { getOperationScheduleActionFailureMessage } from '../schedule/operationScheduleActionResult';
import { ApprovalTaskRow } from './ApprovalTaskRow';

type ApprovalTaskListItem = {
    task: AdminApprovalTask;
    approveAction: () => Promise<unknown>;
    rejectAction?: () => Promise<unknown>;
};

// A newly completed version of the same task must remain reviewable.
function taskKey(task: AdminApprovalTask) {
    switch (task.kind) {
        case 'plantStatusRequest':
            return task.id;
        case 'scheduleOperationVerification':
            return `${task.id}:${task.expectedTaskVersionEventId}`;
        case 'schedulePlantingVerification':
            return `${task.id}:${task.expectedPlantCycleEventId}:${task.expectedPlantCycleVersionEventId}`;
    }
}

export function ApprovalTaskList({ items }: { items: ApprovalTaskListItem[] }) {
    const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(() => new Set());
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [pendingCount, setPendingCount] = useState(0);
    const pendingKeys = useRef(new Set<string>());
    const listRef = useRef<HTMLUListElement>(null);
    const statusRef = useRef<HTMLDivElement>(null);
    const visibleItems = items.filter(
        ({ task }) => !hiddenKeys.has(taskKey(task)),
    );

    async function resolveTask(
        item: ApprovalTaskListItem,
        action: () => Promise<unknown>,
    ) {
        const key = taskKey(item.task);
        if (pendingKeys.current.has(key)) return;
        pendingKeys.current.add(key);

        // Keep keyboard focus in the queue when its current row disappears.
        const rows = Array.from(listRef.current?.children ?? []);
        const focusedIndex = rows.findIndex((row) =>
            row.contains(document.activeElement),
        );
        if (focusedIndex >= 0) {
            const nextRow = rows[focusedIndex + 1] ?? rows[focusedIndex - 1];
            const nextButton = nextRow?.querySelector('button');
            (nextButton ?? statusRef.current)?.focus({ preventScroll: true });
        }

        setHiddenKeys((current) => new Set(current).add(key));
        setErrors((current) => {
            const next = { ...current };
            delete next[key];
            return next;
        });
        setPendingCount((current) => current + 1);

        let failureMessage: string | undefined;
        try {
            const result = await action();
            failureMessage = getOperationScheduleActionFailureMessage(result);
        } catch (error) {
            unstable_rethrow(error);
            failureMessage =
                'Zahtjev nije obrađen. Pokušajte ponovno ili osvježite stranicu.';
        } finally {
            pendingKeys.current.delete(key);
            setPendingCount((current) => current - 1);
        }

        if (failureMessage) {
            const message = failureMessage;
            setHiddenKeys((current) => {
                const next = new Set(current);
                next.delete(key);
                return next;
            });
            setErrors((current) => ({ ...current, [key]: message }));
        }
    }

    return (
        <>
            <div
                ref={statusRef}
                role="status"
                aria-live="polite"
                tabIndex={-1}
                className={
                    pendingCount > 0 || visibleItems.length === 0
                        ? 'flex items-center justify-center gap-2 p-4 text-sm text-muted-foreground'
                        : 'sr-only'
                }
            >
                {pendingCount > 0 ? (
                    <>
                        <Spinner
                            loadingLabel="Obrada zahtjeva"
                            aria-hidden="true"
                        />
                        Obrada zahtjeva: {pendingCount}
                    </>
                ) : visibleItems.length === 0 ? (
                    'Nema zahtjeva za odobrenje.'
                ) : (
                    `Zahtjevi za odobrenje: ${visibleItems.length}`
                )}
            </div>
            {visibleItems.length > 0 ? (
                <ul
                    ref={listRef}
                    className="divide-y"
                    aria-label="Zahtjevi za odobrenje"
                >
                    {visibleItems.map((item) => {
                        const rejectAction = item.rejectAction;
                        return (
                            <ApprovalTaskRow
                                key={taskKey(item.task)}
                                task={item.task}
                                error={errors[taskKey(item.task)]}
                                onApprove={() =>
                                    resolveTask(item, item.approveAction)
                                }
                                onReject={
                                    rejectAction
                                        ? () => resolveTask(item, rejectAction)
                                        : undefined
                                }
                            />
                        );
                    })}
                </ul>
            ) : null}
        </>
    );
}
