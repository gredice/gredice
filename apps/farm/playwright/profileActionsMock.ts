import type { FarmProfileActionState } from '../app/settings/profileActions';

export async function updateFarmProfile(
    _previousState: FarmProfileActionState,
    formData: FormData,
): Promise<FarmProfileActionState> {
    const response = await fetch('/test/farm-profile', {
        method: 'POST',
        body: formData,
    });
    return response.json();
}
