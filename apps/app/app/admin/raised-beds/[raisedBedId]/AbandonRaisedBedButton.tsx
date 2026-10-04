'use client';

import {
    RAISED_BED_ABANDONED_ACTIONS_DISABLED_MESSAGE,
    RAISED_BED_ABANDONED_DUE_TO_INACTIVITY_MESSAGE,
} from '@gredice/js/raisedBeds';
import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { Warning } from '@gredice/ui/icons';
import { ModalConfirm } from '@gredice/ui/ModalConfirm';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useState, useTransition } from 'react';
import { abandonRaisedBedDueToInactivityAction } from '../../../(actions)/raisedBedActions';

export function AbandonRaisedBedButton({
    disabled,
    isAbandoned,
    raisedBedId,
    raisedBedName,
}: {
    disabled?: boolean;
    isAbandoned: boolean;
    raisedBedId: number;
    raisedBedName: string;
}) {
    const [isPending, startTransition] = useTransition();
    const [message, setMessage] = useState<string | null>(null);
    const [isError, setIsError] = useState(false);

    if (isAbandoned) {
        return (
            <Alert
                color="warning"
                startDecorator={<Warning className="size-4 shrink-0" />}
            >
                <Stack spacing={1}>
                    <Typography level="body2" semiBold>
                        {RAISED_BED_ABANDONED_DUE_TO_INACTIVITY_MESSAGE}
                    </Typography>
                    <Typography level="body3">
                        {RAISED_BED_ABANDONED_ACTIONS_DISABLED_MESSAGE}
                    </Typography>
                </Stack>
            </Alert>
        );
    }

    function handleConfirm() {
        setMessage(null);
        setIsError(false);

        startTransition(async () => {
            try {
                const result =
                    await abandonRaisedBedDueToInactivityAction(raisedBedId);
                setMessage(result.message);
                setIsError(!result.success);
            } catch (error) {
                setMessage(
                    error instanceof Error
                        ? error.message
                        : 'Došlo je do greške pri napuštanju gredice.',
                );
                setIsError(true);
            }
        });
    }

    return (
        <Stack spacing={3}>
            <ModalConfirm
                title="Napuštanje gredice zbog neaktivnosti"
                header="Označi gredicu kao napuštenu"
                confirmLabel="Napusti gredicu"
                onConfirm={handleConfirm}
                trigger={
                    <Button
                        type="button"
                        color="danger"
                        disabled={disabled || isPending}
                        fullWidth
                        loading={isPending}
                        variant="outlined"
                    >
                        Napusti zbog neaktivnosti
                    </Button>
                }
            >
                <Stack spacing={3}>
                    <Typography>
                        Gredica <strong>{raisedBedName}</strong> bit će označena
                        kao napuštena zbog neaktivnosti.
                    </Typography>
                    <Typography level="body2">
                        Nakon toga korisnik više neće moći dodati novu sjetvu ni
                        kupiti radnje za ovu gredicu.
                    </Typography>
                </Stack>
            </ModalConfirm>
            {message && (
                <Alert
                    color={isError ? 'danger' : 'success'}
                    startDecorator={
                        isError ? (
                            <Warning className="size-4 shrink-0" />
                        ) : undefined
                    }
                >
                    <Typography level="body2">{message}</Typography>
                </Alert>
            )}
        </Stack>
    );
}
