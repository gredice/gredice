'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@signalco/ui-primitives/Card";
import { Input } from "@signalco/ui-primitives/Input";
import { Button } from "@signalco/ui-primitives/Button";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Alert } from "@signalco/ui/Alert";
import { authCurrentUserQueryKeys } from "@signalco/auth-client";
import { queryClient } from "../../components/providers/ClientAppProvider";
import { useActionState } from "react";
import { AlertTriangle } from "lucide-react";

export function LoginDialog() {
    const [error, submitAction, isPending] = useActionState(async (_previousState: unknown, formData: FormData) => {
        const email = formData.get('email') as string;
        const password = formData.get('password') as string;

        // Send the form data to the server
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        if (response.status !== 204) {
            console.error('Login failed with status', response.status);
            return { error: true }
        }

        queryClient.invalidateQueries({ queryKey: authCurrentUserQueryKeys });
        window.location.reload();
    }, null);

    return (
        <Card className="w-80 shadow-lg">
            <CardHeader>
                <CardTitle>Login</CardTitle>
            </CardHeader>
            <CardContent>
                <form action={submitAction}>
                    <Stack spacing={2}>
                        <Input name="email" label="Email" type="email" autoComplete="email" />
                        <Input name="password" label="Password" type="password" autoComplete="current-password" />
                        <Button type="submit" loading={isPending}>Login</Button>
                        {error && (
                            <Alert color="danger" startDecorator={<AlertTriangle />}>
                                Greška prilikom prijave. Pokušajte ponovo.
                            </Alert>
                        )}
                    </Stack>
                </form>
            </CardContent>
        </Card>
    )
}
