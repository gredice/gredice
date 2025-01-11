import { useState, useEffect } from 'react'
import { Input } from '@signalco/ui-primitives/Input';
import { Button } from '@signalco/ui-primitives/Button';
import { Stack } from '@signalco/ui-primitives/Stack';

interface EmailPasswordFormProps {
    onSubmit: (email: string, password: string) => void
    submitText: string
    registration?: boolean
}

export default function EmailPasswordForm({
    onSubmit,
    submitText,
    registration: registration = false
}: EmailPasswordFormProps) {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [repeatPassword, setRepeatPassword] = useState('')
    const [passwordsMatch, setPasswordsMatch] = useState(true)

    useEffect(() => {
        if (registration) {
            setPasswordsMatch(password === repeatPassword)
        }
    }, [password, repeatPassword, registration])

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!registration || passwordsMatch) {
            onSubmit(email, password)
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
                        {!passwordsMatch && (
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
                    disabled={registration && !passwordsMatch}
                >
                    {submitText}
                </Button>
                {!registration && (
                    <Button
                        type="button"
                        variant="link"
                        className="w-full"
                        href={`/prijava/zaboravljena-zaporka?email=${email}`}
                    >
                        Zaboravljena zaporka?
                    </Button>
                )}
            </Stack>
        </form>
    )
}

