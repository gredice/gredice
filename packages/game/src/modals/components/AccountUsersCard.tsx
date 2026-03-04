import { UserAvatar } from '@gredice/ui/UserAvatar';
import { Card, CardContent } from '@signalco/ui-primitives/Card';
import { Row } from '@signalco/ui-primitives/Row';
import { Spinner } from '@signalco/ui-primitives/Spinner';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useCurrentAccountUsers } from '../../hooks/useCurrentAccountUsers';

export function AccountUsersCard() {
    const accountUsers = useCurrentAccountUsers();

    return (
        <Card>
            <CardContent noHeader>
                <Stack spacing={2}>
                    <Stack spacing={0.5}>
                        <Typography level="body1" semiBold>
                            Korisnici na računu
                        </Typography>
                        <Typography level="body3">
                            Ovdje ćeš uskoro moći upravljati korisnicima na
                            računu.
                        </Typography>
                    </Stack>
                    {accountUsers.isLoading && (
                        <Spinner
                            loading
                            className="size-5"
                            loadingLabel="Učitavanje korisnika..."
                        />
                    )}
                    {accountUsers.isSuccess &&
                        accountUsers.data.length === 0 && (
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
                    {accountUsers.isSuccess && accountUsers.data.length > 0 && (
                        <Stack spacing={1}>
                            {accountUsers.data.map((user) => (
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
                </Stack>
            </CardContent>
        </Card>
    );
}
