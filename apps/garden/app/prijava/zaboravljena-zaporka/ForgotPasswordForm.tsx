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
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();

        setError('');
        setIsLoading(true);
        try {
            const response = await clientPublic().api.auth[
                'send-change-password-email'
            ].$post({
                json: {
                    email,
                },
            });

            if (response.ok) {
                router.push('/prijava/zaboravljena-zaporka/poslano');
                return;
            }

            setError(errorMessages.forgotPasswordEmail);
        } catch {
            setError(errorMessages.forgotPasswordEmail);
        } finally {
            setIsLoading(false);
        }
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
                    autoComplete="email"
                    className="h-11"
                    fullWidth
                    inputMode="email"
                    required
                    style={{ fontSize: '16px' }}
                />
                {error && (
                    <Typography
                        level="body2"
                        color="danger"
                        role="alert"
                        semiBold
                    >
                        {error}
                    </Typography>
                )}
                <Button
                    type="submit"
                    variant="soft"
                    fullWidth
                    loading={isLoading}
                    size="lg"
                >
                    Pošalji email
                </Button>
            </Stack>
        </form>
    );
}
