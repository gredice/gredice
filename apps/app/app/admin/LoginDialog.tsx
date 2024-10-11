'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@signalco/ui-primitives/Card";
import { Input } from "@signalco/ui-primitives/Input";
import { Button } from "@signalco/ui-primitives/Button";
import { Stack } from "@signalco/ui-primitives/Stack";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { authCurrentUserQueryKeys } from "@signalco/auth-client";

export function LoginDialog() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        // Get the form data
        const formData = new FormData(e.currentTarget);
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
            // TODO: Show notification
            console.log('Login failed with status', response.status);
            return;
        }

        queryClient.invalidateQueries({ queryKey: authCurrentUserQueryKeys });
        window.location.reload();
    }

    return (
        <Card className="w-80 shadow-lg">
            <CardHeader>
                <CardTitle>Login</CardTitle>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit}>
                    <Stack spacing={2}>
                        <Input name="email" label="Email" type="email" autoComplete="email" />
                        <Input name="password" label="Password" type="password" autoComplete="current-password" />
                        <Button type="submit">Login</Button>
                    </Stack>
                </form>
            </CardContent>
        </Card>
    )
}
