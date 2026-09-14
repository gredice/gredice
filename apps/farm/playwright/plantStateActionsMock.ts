import type { PlantStateRequestActionState } from '../app/raised-beds/[raisedBedId]/actions';

declare global {
    interface Window {
        plantStateTest?: {
            fail?: boolean;
            submission?: {
                raisedBedId: FormDataEntryValue | null;
                positionIndex: FormDataEntryValue | null;
                status: FormDataEntryValue | null;
                plantingId?: FormDataEntryValue | null;
                expectedLifecycleVersionEventId?: FormDataEntryValue | null;
                expectedPlantSortId?: FormDataEntryValue | null;
            };
        };
    }
}

export async function requestPlantStateChangeAction(
    _state: PlantStateRequestActionState,
    formData: FormData,
): Promise<PlantStateRequestActionState> {
    window.plantStateTest ??= {};
    window.plantStateTest.submission = {
        raisedBedId: formData.get('raisedBedId'),
        positionIndex: formData.get('positionIndex'),
        status: formData.get('status'),
        ...(formData.has('plantingId')
            ? {
                  plantingId: formData.get('plantingId'),
                  expectedLifecycleVersionEventId: formData.get(
                      'expectedLifecycleVersionEventId',
                  ),
                  expectedPlantSortId: formData.get('expectedPlantSortId'),
              }
            : {}),
    };
    return window.plantStateTest.fail
        ? {
              success: false,
              message: 'Promjena nije spremljena. Pokušajte ponovno.',
          }
        : { success: true, message: 'Zahtjev je poslan.' };
}
