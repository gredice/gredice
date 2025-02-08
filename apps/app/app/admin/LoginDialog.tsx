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
        if (response.status !== 200) {
            console.error('Login failed with status', response.status);
            return { error: true }
        }

        const { token } = await response.json();
        localStorage.setItem('gredice-token', token);

        queryClient.invalidateQueries({ queryKey: authCurrentUserQueryKeys });
        window.location.reload();
    }, null);

    return (
        <div className="h-[calc(100vh)] flex items-center justify-center">
            <Card>
                <Stack>
                    <CardHeader>
                        <CardTitle>Prijava</CardTitle>
                    </CardHeader>
                    <CardContent className="min-w-96">
                        <form action={submitAction}>
                            <Stack spacing={4}>
                                <Stack spacing={1}>
                                    <Input name="email" label="Email" placeholder="email@email.com" type="email" autoComplete="email" />
                                    <Input name="password" label="Zaporka" type="password" autoComplete="current-password" />
                                </Stack>
                                <Button type="submit" loading={isPending} variant="solid">Prijavi se</Button>
                                {error && (
                                    <Alert color="danger" startDecorator={<AlertTriangle />}>
                                        Greška prilikom prijave. Pokušajte ponovo.
                                    </Alert>
                                )}
                            </Stack>
                        </form>
                    </CardContent>
                </Stack>
            </Card>
        </div>
    )
}
