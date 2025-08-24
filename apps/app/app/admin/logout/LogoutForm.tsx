'use client';

import { authCurrentUserQueryKeys } from '@signalco/auth-client';
import { Alert } from '@signalco/ui/Alert';
import { Warning } from '@signalco/ui-icons';
import { Row } from '@signalco/ui-primitives/Row';
import { Spinner } from '@signalco/ui-primitives/Spinner';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useActionState } from 'react';
import { queryClient } from '../../../components/providers/ClientAppProvider';
import { KnownPages } from '../../../src/KnownPages';

function autoSubmitForm(form: HTMLFormElement | null) {
    form?.requestSubmit();
}

export function LogoutForm() {
    const [error, submitAction] = useActionState(async () => {
        const response = await fetch('/api/logout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
        });
        if (response.status !== 200) {
            console.error('Logout failed with status', response.status);
            return { error: true };
        }

        await queryClient.invalidateQueries({
            queryKey: authCurrentUserQueryKeys,
        });
        window.location.href = KnownPages.Dashboard;
    }, null);

    return (
        <form ref={autoSubmitForm} action={submitAction}>
            <Stack spacing={4}>
                {!error && (
                    <Row spacing={1} className="flex justify-center">
                        <Spinner loadingLabel={'Odjava...'} loading />
                        <Typography level="h6" semiBold>
                            Odjva u tijeku...
                        </Typography>
                    </Row>
                )}
                {error && (
                    <Alert color="danger" startDecorator={<Warning />}>
                        Došlo je do greške prilikom odjave.
                    </Alert>
                )}
            </Stack>
        </form>
    );
}
