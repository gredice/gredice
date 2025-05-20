import { useState, useEffect, FormEvent } from 'react'
import { Input } from '@signalco/ui-primitives/Input';
import { Button } from '@signalco/ui-primitives/Button';
import { Stack } from '@signalco/ui-primitives/Stack';

interface EmailPasswordFormProps {
    onSubmit: (email: string, password: string) => Promise<void>
    submitText: string
    registration?: boolean
}

export function EmailPasswordForm({
    onSubmit,
    submitText,
    registration: registration = false
}: EmailPasswordFormProps) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [repeatPassword, setRepeatPassword] = useState('');
    const [passwordsMatch, setPasswordsMatch] = useState<boolean | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (registration && typeof passwordsMatch === 'boolean') {
            setPasswordsMatch(password === repeatPassword)
        }
    }, [password, repeatPassword, registration])

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault()

        const doPasswordsMarch = password === repeatPassword;
        setPasswordsMatch(doPasswordsMarch);

        if (!registration || doPasswordsMarch) {
            setIsLoading(true);
            onSubmit(email, password).then(() => setIsLoading(false));
        }
    }

    return (
        <form onSubmit={handleSubmit} className="gap-6 flex flex-col">
            <Stack spacing={1}>
                <Input
                    id="email"
                    type="email"
                    label='Email'
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />
                <Input
                    id="password"
                    type="password"
                    label="Zaporka"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                />
                {registration && (
                    <Stack spacing={1}>
                        <Input
                            id="repeatPassword"
                            type="password"
                            label="Ponovi zaporku"
                            value={repeatPassword}
                            onChange={(e) => setRepeatPassword(e.target.value)}
                            required
                        />
                        {passwordsMatch === false && (
                            <p className="text-sm text-red-500">Zaporke se ne podudaraju</p>
                        )}
                    </Stack>
                )}
            </Stack>
            <Stack spacing={1}>
                <Button
                    type="submit"
                    fullWidth
                    variant='soft'
                    disabled={registration && !(Boolean(password.length) && Boolean(repeatPassword.length))}
                    loading={isLoading}
                >
                    {submitText}
                </Button>
                {!registration && (
                    <Button
                        type="button"
                        variant="link"
                        className="w-full"
                        href={`/prijava/zaboravljena-zaporka?email=${encodeURIComponent(email)}`}
                    >
                        Zaboravljena zaporka?
                    </Button>
                )}
            </Stack>
        </form>
    )
}

