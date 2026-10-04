'use client';

import { getBrowserGrediceAppOrigin } from '@gredice/client';
import { Alert } from '@gredice/ui/Alert';
import { authCurrentUserQueryKeys } from '@gredice/ui/auth';
import { Warning } from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';
import { Spinner } from '@gredice/ui/Spinner';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useActionState } from 'react';
import { queryClient } from '../../../components/providers/ClientAppProvider';

function getLandingUrl() {
    return getBrowserGrediceAppOrigin('www');
}

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
        window.location.href = getLandingUrl();
    }, null);

    return (
        <form ref={autoSubmitForm} action={submitAction}>
            <Stack spacing={8}>
                {!error && (
                    <Row spacing={2} className="flex justify-center">
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
