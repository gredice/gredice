'use client'

import { FormEvent, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from "@signalco/ui-primitives/Button"
import { Input } from "@signalco/ui-primitives/Input"
import { Stack } from '@signalco/ui-primitives/Stack'
import { Typography } from '@signalco/ui-primitives/Typography'
import { apiFetch } from '../../../lib/apiFetch'
import { errorMessages } from '../../../misc/errorMessages'

export function ForgotPasswordForm() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [email, setEmail] = useState(searchParams.get('email') || '')
    const [error, setError] = useState('');

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()

        setError('');
        const response = await apiFetch('/api/auth/send-change-password-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
        });
        if (!response.ok) {
            console.error(response.statusText);
            setError(errorMessages.forgotPasswordEmail);
            return;
        }

        router.push('/prijava/zaboravljena-zaporka/poslano')
    }

    return (
        <form onSubmit={handleSubmit}>
            <Stack spacing={3}>
                <Typography level='body2' center>Unesi svoj email za promjenu zaporke</Typography>
                <Input
                    id="email"
                    type="email"
                    label='Email'
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />
                {error && <Typography level='body2' color='danger' semiBold>{error}</Typography>}
                <Button type="submit" variant="soft" fullWidth>
                    Pošalji email
                </Button>
            </Stack>
        </form>
    );
}
