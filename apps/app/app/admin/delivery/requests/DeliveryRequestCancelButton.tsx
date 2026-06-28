'use client';

import { IconButton } from '@gredice/ui/IconButton';
import { Close } from '@gredice/ui/icons';
import { useRouter } from 'next/navigation';
import { CancelRequestModal } from '../../schedule/CancelRequestModal';
import { updateDeliveryRequestStatusAction } from './actions';
import type { DeliveryRequestActionData } from './DeliveryRequestTypes';

function canCancelDeliveryRequest(state: string) {
    return state === 'pending' || state === 'confirmed';
}

export function DeliveryRequestCancelButton({
    label,
    request,
}: {
    label: string;
    request: DeliveryRequestActionData;
}) {
    const router = useRouter();

    if (!canCancelDeliveryRequest(request.state)) {
        return null;
    }

    async function cancelRequest(formData: FormData) {
        const reason = formData.get('reason');
        if (typeof reason === 'string') {
            formData.set('cancelReason', reason);
        }

        const result = await updateDeliveryRequestStatusAction(null, formData);
        if (!result.success) {
            throw new Error(result.message);
        }

        router.refresh();
    }

    return (
        <CancelRequestModal
            label={label}
            description="Zahtjev će biti otkazan i korisnik će dobiti obavijest o otkazivanju."
            confirmLabel="Otkaži zahtjev"
            hiddenFields={
                <>
                    <input type="hidden" name="requestId" value={request.id} />
                    <input type="hidden" name="status" value="cancelled" />
                </>
            }
            onSubmit={cancelRequest}
            trigger={
                <IconButton
                    variant="plain"
                    color="danger"
                    size="sm"
                    title="Otkaži zahtjev"
                >
                    <Close className="size-4 shrink-0" />
                </IconButton>
            }
        />
    );
}
