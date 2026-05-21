import { Button } from '@gredice/ui/Button';
import { Card, CardContent } from '@gredice/ui/Card';
import { Modal } from '@gredice/ui/Modal';
import { Row } from '@gredice/ui/Row';
import { Spinner } from '@gredice/ui/Spinner';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { UserAvatar } from '@gredice/ui/UserAvatar';
import { Add } from '@signalco/ui-icons';
import { useCurrentAccountUsers } from '../../hooks/useCurrentAccountUsers';
import { InviteUserForm } from './InviteUserForm';
import { PendingInvitationsList } from './PendingInvitationsList';

export function AccountUsersCard() {
    const accountUsers = useCurrentAccountUsers();

    return (
        <Card>
            <CardContent noHeader>
                <Stack spacing={2}>
                    <Row
                        spacing={1}
                        justifyContent="space-between"
                        alignItems="start"
                    >
                        <Stack spacing={0.5}>
                            <Typography level="body1" semiBold>
                                Korisnici na računu
                            </Typography>
                            <Typography level="body3">
                                Upravljaj korisnicima na računu i pozovi nove
                                korisnike.
                            </Typography>
                        </Stack>
                        <Modal
                            trigger={
                                <Button
                                    variant="solid"
                                    size="sm"
                                    startDecorator={<Add className="size-4" />}
                                >
                                    Pozovi
                                </Button>
                            }
                            title="Pozovi korisnika"
                        >
                            <Stack spacing={2}>
                                <Typography level="h5">
                                    Pozovi novog korisnika
                                </Typography>
                                <Typography level="body2">
                                    Unesite email adresu korisnika kojeg želite
                                    pozvati na račun.
                                </Typography>
                                <InviteUserForm />
                            </Stack>
                        </Modal>
                    </Row>
                    {accountUsers.isLoading && (
                        <Spinner
                            loading
                            className="size-5"
                            loadingLabel="Učitavanje korisnika..."
                        />
                    )}
                    {accountUsers.isSuccess &&
                        (accountUsers.data?.length ?? 0) === 0 && (
                            <Typography level="body3">
                                Trenutno nema pridruženih korisnika.
                            </Typography>
                        )}
                    {accountUsers.isError && (
                        <Typography level="body3">
                            Došlo je do greške pri učitavanju korisnika. Pokušaj
                            ponovno kasnije.
                        </Typography>
                    )}
                    {accountUsers.isSuccess &&
                        (accountUsers.data?.length ?? 0) > 0 && (
                            <Stack spacing={1}>
                                {accountUsers.data?.map((user) => (
                                    <Row
                                        key={user.id}
                                        spacing={2}
                                        className="items-center"
                                    >
                                        <UserAvatar
                                            avatarUrl={user.avatarUrl}
                                            displayName={user.displayName}
                                            className="size-8"
                                        />
                                        <Stack spacing={0}>
                                            <Typography level="body2" semiBold>
                                                {user.displayName}
                                            </Typography>
                                            <Typography level="body3">
                                                {user.userName}
                                            </Typography>
                                        </Stack>
                                    </Row>
                                ))}
                            </Stack>
                        )}
                    <PendingInvitationsList />
                </Stack>
            </CardContent>
        </Card>
    );
}
