'use client';

import { clientPublic } from '@gredice/client';
import { Button } from '@gredice/ui/Button';
import { Input } from '@gredice/ui/Input';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useRouter, useSearchParams } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { errorMessages } from '../../../misc/errorMessages';

export function ForgotPasswordForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [email, setEmail] = useState(searchParams.get('email') || '');
    const [error, setError] = useState('');

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();

        setError('');
        const response = await clientPublic().api.auth[
            'send-change-password-email'
        ].$post({
            json: {
                email,
            },
        });

        if (!response.ok) {
            console.error(response.statusText);
            setError(errorMessages.forgotPasswordEmail);
            return;
        }

        router.push('/prijava/zaboravljena-zaporka/poslano');
    };

    return (
        <form onSubmit={handleSubmit}>
            <Stack spacing={6}>
                <Typography level="body2" center>
                    Unesi svoj email za promjenu zaporke
                </Typography>
                <Input
                    id="email"
                    type="email"
                    label="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />
                {error && (
                    <Typography level="body2" color="danger" semiBold>
                        {error}
                    </Typography>
                )}
                <Button type="submit" variant="soft" fullWidth>
                    Pošalji email
                </Button>
            </Stack>
        </form>
    );
}
