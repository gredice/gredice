declare global {
    interface Window {
        observationTest?: {
            fail?: boolean;
            submissionUncertain?: boolean;
            throwAfterCommit?: boolean;
            committedSubmissions?: Record<string, string>;
            recoveredImageUrl?: string;
            recoveryRequests?: string[];
            hold?: boolean;
            release?: () => void;
            submissions?: {
                target: string | null;
                notes: string | null;
                submissionId: string | null;
                imageUrls: string | null;
            }[];
        };
    }
}

export async function submitRaisedBedObservationAction(formData: FormData) {
    window.observationTest ??= {};
    const state = window.observationTest;
    state.submissions ??= [];
    const stringValue = (key: string) => {
        const value = formData.get(key);
        return typeof value === 'string' ? value : null;
    };
    const snapshot = {
        target: stringValue('target'),
        notes: stringValue('notes'),
        submissionId: stringValue('submissionId'),
        imageUrls: stringValue('imageUrls'),
    };
    state.submissions.push(snapshot);
    if (state.hold)
        await new Promise<void>((resolve) => {
            state.release = resolve;
        });
    if (!state.fail || state.throwAfterCommit || state.submissionUncertain) {
        state.committedSubmissions ??= {};
        const receipt = snapshot.submissionId ?? '';
        const fingerprint = JSON.stringify(snapshot);
        const previous = state.committedSubmissions[receipt];
        if (previous && previous !== fingerprint)
            throw new Error('Submission receipt content changed');
        state.committedSubmissions[receipt] = fingerprint;
    }
    if (state.throwAfterCommit) throw new Error('Response lost after commit');
    return state.fail
        ? {
              success: false,
              submissionUncertain: state.submissionUncertain ?? false,
              message: 'Opažanje nije spremljeno. Pokušaj ponovno.',
          }
        : {
              success: true,
              message: 'Opažanje je poslano administratorima na odobrenje.',
              operationId: 42,
          };
}

export async function recoverRaisedBedObservationImageAction(input: {
    pathname: string;
}) {
    window.observationTest ??= {};
    const state = window.observationTest;
    state.recoveryRequests ??= [];
    state.recoveryRequests.push(input.pathname);
    return state.recoveredImageUrl ?? null;
}
