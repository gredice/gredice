import { Button } from '@signalco/ui-primitives/Button';
import { Row } from '@signalco/ui-primitives/Row';
import { Spinner } from '@signalco/ui-primitives/Spinner';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useAccountInvitations } from '../../hooks/useAccountInvitations';
import { useCancelInvitation } from '../../hooks/useInvitationMutations';

export function PendingInvitationsList() {
    const invitations = useAccountInvitations();
    const cancelInvitation = useCancelInvitation();

    if (invitations.isLoading) {
        return (
            <Spinner
                loading
                className="size-5"
                loadingLabel="Učitavanje pozivnica..."
            />
        );
    }

    if (invitations.isError) {
        return (
            <Typography level="body3">
                Došlo je do greške pri učitavanju pozivnica.
            </Typography>
        );
    }

    if (!invitations.data || invitations.data.length === 0) {
        return null;
    }

    return (
        <Stack spacing={1}>
            <Typography level="body2" semiBold>
                Poslane pozivnice
            </Typography>
            {invitations.data.map((invitation) => (
                <Row
                    key={invitation.id}
                    spacing={2}
                    className="items-center justify-between"
                >
                    <Stack spacing={0}>
                        <Typography level="body2">
                            {invitation.email}
                        </Typography>
                        <Typography level="body3">Na čekanju</Typography>
                    </Stack>
                    <Button
                        variant="plain"
                        size="sm"
                        onClick={() => cancelInvitation.mutate(invitation.id)}
                        loading={cancelInvitation.isPending}
                    >
                        Otkaži
                    </Button>
                </Row>
            ))}
        </Stack>
    );
}
