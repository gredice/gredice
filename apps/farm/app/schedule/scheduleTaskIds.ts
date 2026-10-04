export type ScheduleTaskKind = 'operation' | 'planting';

export function getScheduleTaskAnchorId(
    kind: ScheduleTaskKind,
    taskId: number,
) {
    return `schedule-task-${kind}-${taskId}`;
}

export function getScheduleOperationProofRequirementsId(operationId: number) {
    return `schedule-operation-${operationId}-proof-requirements`;
}

export function getScheduleTaskLabelId(kind: ScheduleTaskKind, taskId: number) {
    return `${getScheduleTaskAnchorId(kind, taskId)}-label`;
}
