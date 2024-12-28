'use client';

import { Card } from "@signalco/ui-primitives/Card";
import { Alert } from "@signalco/ui/Alert";
import { authCurrentUserQueryKeys } from "@signalco/auth-client";
import { useActionState } from "react";
import { AlertTriangle } from "lucide-react";
import { queryClient } from "../../../components/providers/ClientAppProvider";
import { Spinner } from '@signalco/ui-primitives/Spinner';
import { Row } from "@signalco/ui-primitives/Row";
import { Typography } from "@signalco/ui-primitives/Typography";
import { KnownPages } from "../../../src/KnownPages";
import { Stack } from "@signalco/ui-primitives/Stack";

function autoSubmitForm(form: HTMLFormElement | null) {
    form?.requestSubmit();
}

export function LogoutForm() {
    const [error, submitAction] = useActionState(async () => {
        const response = await fetch('/api/logout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        if (response.status !== 200) {
            console.error('Logout failed with status', response.status);
            return { error: true }
        }

        queryClient.invalidateQueries({ queryKey: authCurrentUserQueryKeys });
        window.location.href = KnownPages.Dashboard;
    }, null);

    return (
        <Card className="p-12">
            <form ref={autoSubmitForm} action={submitAction}>
                <Stack spacing={4}>
                    {!error && (
                        <Row spacing={1} className="flex justify-center">
                            <Spinner loadingLabel={"Odjava..."} loading />
                            <Typography level="h6" semiBold>Odjva u tijeku...</Typography>
                        </Row>
                    )}
                    {error && (
                        <Alert color="danger" startDecorator={<AlertTriangle />}>
                            Došlo je do greške prilikom odjave.
                        </Alert>
                    )}
                </Stack>
            </form>
        </Card>
    );
}
