export type ScheduleTaskSubmissionState =
    | 'pendingVerification'
    | 'completed'
    | 'blocked';

export type ScheduleTaskSubmissionFailureCode =
    | 'assignment_changed'
    | 'invalid_input'
    | 'invalid_status'
    | 'not_authorized'
    | 'not_found'
    | 'submission_conflict'
    | 'task_changed';

export type ScheduleTaskSubmissionSuccess = {
    recordedAt: string;
    state: ScheduleTaskSubmissionState;
    success: true;
};

export type ScheduleTaskSubmissionFailure = {
    canRetry: boolean;
    code: ScheduleTaskSubmissionFailureCode;
    message: string;
    retryImageUrls?: string[];
    success: false;
};

export type ScheduleTaskSubmissionResult =
    | ScheduleTaskSubmissionSuccess
    | ScheduleTaskSubmissionFailure;

export function getScheduleTaskCompletionSuccessMessage({
    kind,
    label,
    state,
}: {
    kind: 'operation' | 'planting';
    label: string;
    state: Exclude<ScheduleTaskSubmissionState, 'blocked'>;
}) {
    if (state === 'pendingVerification') {
        return kind === 'operation'
            ? `Radnja „${label}” spremljena je i čeka potvrdu.`
            : `Sijanje „${label}” spremljeno je i čeka potvrdu.`;
    }

    return kind === 'operation'
        ? `Radnja „${label}” je potvrđena.`
        : `Sijanje „${label}” je potvrđeno.`;
}
