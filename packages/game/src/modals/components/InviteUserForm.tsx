import { Button } from '@signalco/ui-primitives/Button';
import { Input } from '@signalco/ui-primitives/Input';
import { Row } from '@signalco/ui-primitives/Row';
import { Typography } from '@signalco/ui-primitives/Typography';
import { type FormEvent, useState } from 'react';
import { useSendInvitation } from '../../hooks/useInvitationMutations';

export function InviteUserForm() {
    const [email, setEmail] = useState('');
    const [error, setError] = useState<string | null>(null);
    const sendInvitation = useSendInvitation();

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!email.trim()) return;

        try {
            await sendInvitation.mutateAsync(email.trim());
            setEmail('');
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Došlo je do greške pri slanju pozivnice.',
            );
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <Row spacing={1} className="items-end">
                <Input
                    name="email"
                    type="email"
                    label="Email korisnika"
                    placeholder="email@primjer.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-card"
                />
                <Button
                    type="submit"
                    variant="solid"
                    loading={sendInvitation.isPending}
                    disabled={!email.trim() || sendInvitation.isPending}
                >
                    Pozovi
                </Button>
            </Row>
            {error && (
                <Typography level="body3" className="text-red-600 mt-1">
                    {error}
                </Typography>
            )}
        </form>
    );
}
