'use client';

import { client } from '@gredice/client';
import { Alert } from '@signalco/ui/Alert';
import { Button } from '@signalco/ui-primitives/Button';
import { Input } from '@signalco/ui-primitives/Input';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { errorMessages } from '../../../misc/errorMessages';

export function ChangePasswordForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get('token');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setError(errorMessages.passwordsDontMatch);
            return;
        }
        if (!token) {
            setError(errorMessages.tokenInvalid);
            return;
        }

        const response = await client().api.auth['change-password'].$post({
            json: {
                password,
                token,
            },
        });

        if (!response.ok) {
            console.error(response.statusText);
            setError(errorMessages.changePassword);
            return;
        }

        router.push('/prijava/promjena-zaporke/uspijeh');
    };

    return (
        <form onSubmit={handleSubmit}>
            <Stack spacing={3}>
                {!token ? (
                    <>
                        <Alert color="danger">
                            Link za promjenu zaporke nije ispravan
                        </Alert>
                        <Link href="/prijava/zaboravljena-zaporka">
                            <Button fullWidth variant="soft">
                                Povratak
                            </Button>
                        </Link>
                    </>
                ) : (
                    <>
                        <Typography level="body2">
                            Unesi svoju novu zaporku
                        </Typography>
                        <Stack spacing={1}>
                            <Input
                                id="password"
                                type="password"
                                label="Nova zaporka"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                            <Input
                                id="confirmPassword"
                                type="password"
                                label="Potvrda nove zaporka"
                                value={confirmPassword}
                                onChange={(e) =>
                                    setConfirmPassword(e.target.value)
                                }
                                required
                            />
                        </Stack>
                        {error && (
                            <Typography level="body2" color="danger" semiBold>
                                {error}
                            </Typography>
                        )}
                        <Button type="submit" fullWidth variant="soft">
                            Spremi
                        </Button>
                    </>
                )}
            </Stack>
        </form>
    );
}
