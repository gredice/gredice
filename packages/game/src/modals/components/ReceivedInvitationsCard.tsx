import { Button } from '@signalco/ui-primitives/Button';
import { Card, CardContent } from '@signalco/ui-primitives/Card';
import { Row } from '@signalco/ui-primitives/Row';
import { Spinner } from '@signalco/ui-primitives/Spinner';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useAcceptInvitation } from '../../hooks/useInvitationMutations';
import { usePendingInvitations } from '../../hooks/usePendingInvitations';

export function ReceivedInvitationsCard() {
    const pendingInvitations = usePendingInvitations();
    const acceptInvitation = useAcceptInvitation();

    if (pendingInvitations.isLoading) {
        return (
            <Spinner
                loading
                className="size-5"
                loadingLabel="Učitavanje pozivnica..."
            />
        );
    }

    if (
        !pendingInvitations.data ||
        pendingInvitations.data.length === 0
    ) {
        return null;
    }

    return (
        <Card>
            <CardContent noHeader>
                <Stack spacing={2}>
                    <Typography level="body1" semiBold>
                        📬 Pozivnice
                    </Typography>
                    {pendingInvitations.data.map((invitation) => (
                        <Row
                            key={invitation.id}
                            spacing={2}
                            className="items-center justify-between"
                        >
                            <Stack spacing={0}>
                                <Typography level="body2">
                                    {invitation.invitedBy.displayName} te poziva
                                    da se pridružiš računu
                                </Typography>
                            </Stack>
                            <Button
                                variant="solid"
                                size="sm"
                                onClick={() =>
                                    acceptInvitation.mutate(invitation.token)
                                }
                                loading={acceptInvitation.isPending}
                            >
                                Prihvati
                            </Button>
                        </Row>
                    ))}
                </Stack>
            </CardContent>
        </Card>
    );
}
