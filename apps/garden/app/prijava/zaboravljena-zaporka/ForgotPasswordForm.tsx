'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from "@signalco/ui-primitives/Button"
import { Input } from "@signalco/ui-primitives/Input"
import { Stack } from '@signalco/ui-primitives/Stack'
import { Typography } from '@signalco/ui-primitives/Typography'

export function ForgotPasswordForm() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [email, setEmail] = useState(searchParams.get('email') || '')

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        // TODO: Implement forgot password logic here
        console.log('Forgot password request for:', email)
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
                <Button type="submit" variant="soft" fullWidth>
                    Pošalji email
                </Button>
            </Stack>
        </form>
    );
}
