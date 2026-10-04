declare global {
    interface Window {
        observationTest?: {
            fail?: boolean;
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
    state.submissions.push({
        target: stringValue('target'),
        notes: stringValue('notes'),
        submissionId: stringValue('submissionId'),
        imageUrls: stringValue('imageUrls'),
    });
    if (state.hold)
        await new Promise<void>((resolve) => {
            state.release = resolve;
        });
    return state.fail
        ? {
              success: false,
              message: 'Opažanje nije spremljeno. Pokušaj ponovno.',
          }
        : {
              success: true,
              message: 'Opažanje je poslano administratorima na odobrenje.',
              operationId: 42,
          };
}
