'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@signalco/ui-primitives/Card";
import { Input } from "@signalco/ui-primitives/Input";
import { Button } from "@signalco/ui-primitives/Button";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Container } from "@signalco/ui-primitives/Container";
import { Alert } from "@signalco/ui/Alert";
import { authCurrentUserQueryKeys } from "@signalco/auth-client";
import { queryClient } from "../../components/providers/ClientAppProvider";
import { useActionState } from "react";
import { AlertTriangle } from "lucide-react";
import { Typography } from "@signalco/ui-primitives/Typography";

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
        <div className="h-full grid md:grid-cols-2 items-center">
            <div className="h-full hidden lg:flex flex-col text-white bg-muted"></div>
            <form action={submitAction}>
                <Container maxWidth="xs" className="py-4">
                    <Stack spacing={4}>
                        <Typography level="h2" component="h1" className="tracking-tight height">Prijava</Typography>
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
                </Container>
            </form>
        </div>
    )
}
