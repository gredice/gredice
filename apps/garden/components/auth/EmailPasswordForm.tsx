import { Button } from '@gredice/ui/Button';
import { Input } from '@gredice/ui/Input';
import { Stack } from '@gredice/ui/Stack';
import { type FormEvent, useEffect, useState } from 'react';

interface EmailPasswordFormProps {
    onSubmit: (email: string, password: string) => Promise<void>;
    submitText: string;
    autoFocusEmail?: boolean;
    registration?: boolean;
}

export function EmailPasswordForm({
    onSubmit,
    submitText,
    autoFocusEmail = false,
    registration = false,
}: EmailPasswordFormProps) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [repeatPassword, setRepeatPassword] = useState('');
    const [passwordsMatch, setPasswordsMatch] = useState<boolean | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (registration && typeof passwordsMatch === 'boolean') {
            setPasswordsMatch(password === repeatPassword);
        }
    }, [password, repeatPassword, registration, passwordsMatch]);

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();

        const doPasswordsMarch = password === repeatPassword;
        setPasswordsMatch(doPasswordsMarch);

        if (!registration || doPasswordsMarch) {
            setIsLoading(true);
            onSubmit(email, password).then(() => setIsLoading(false));
        }
    };

    return (
        <form onSubmit={handleSubmit} className="flex w-full flex-col gap-6">
            <Stack spacing={2}>
                <Input
                    id="email"
                    type="email"
                    label="Email"
                    autoFocus={autoFocusEmail}
                    fullWidth
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />
                <Input
                    id="password"
                    type="password"
                    label="Zaporka"
                    fullWidth
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                />
                {registration && (
                    <Stack spacing={2}>
                        <Input
                            id="repeatPassword"
                            type="password"
                            label="Ponovi zaporku"
                            fullWidth
                            value={repeatPassword}
                            onChange={(e) => setRepeatPassword(e.target.value)}
                            required
                        />
                        {passwordsMatch === false && (
                            <p className="text-sm text-red-500">
                                Zaporke se ne podudaraju
                            </p>
                        )}
                    </Stack>
                )}
            </Stack>
            <Stack spacing={2}>
                <Button
                    type="submit"
                    fullWidth
                    variant="soft"
                    disabled={
                        registration &&
                        !(
                            Boolean(password.length) &&
                            Boolean(repeatPassword.length)
                        )
                    }
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
    );
}
