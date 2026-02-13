import { client } from '@gredice/client';
import { CompanyFacebook, Security } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { Card, CardContent } from '@signalco/ui-primitives/Card';
import { Row } from '@signalco/ui-primitives/Row';
import { Spinner } from '@signalco/ui-primitives/Spinner';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useCallback, useState } from 'react';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useUserLogins } from '../../hooks/useUserLogins';
import { CompanyGoogle } from './CompanyGoogle';
import { FacebookLoginButton } from './FacebookLoginButton';
import { GoogleLoginButton } from './GoogleLoginButton';

export function SecurityTab() {
    const currentUser = useCurrentUser();
    const { data: userLogins, isLoading: userLoginsLoading } = useUserLogins(
        currentUser.data?.id,
    );
    const passwordLoginConnected = userLogins?.methods?.some(
        (login) => login.provider === 'password',
    );
    const googleConnected = userLogins?.methods?.some(
        (login) => login.provider === 'google',
    );
    const facebookConnected = userLogins?.methods?.some(
        (login) => login.provider === 'facebook',
    );

    const [changePasswordPending, setChangePasswordPending] = useState(false);
    const [changePasswordSent, setChangePasswordSent] = useState(false);
    const handleSendChangePassword = useCallback(async () => {
        const userName = currentUser.data?.userName;
        if (!userName) return;
        setChangePasswordPending(true);
        try {
            await client().api.auth['send-change-password-email'].$post({
                json: { email: userName },
            });
            setChangePasswordSent(true);
        } catch (error) {
            console.error('Failed to send change password email', error);
        } finally {
            setChangePasswordPending(false);
        }
    }, [currentUser.data?.userName]);

    return (
        <Stack spacing={4}>
            <Typography level="h4" className="hidden md:block">
                🔒 Sigurnost
            </Typography>
            <Stack spacing={2}>
                <Card>
                    <CardContent noHeader>
                        <Typography level="body2">
                            Prijava putem email adrese:{' '}
                            <strong>{currentUser.data?.userName}</strong>
                        </Typography>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent noHeader>
                        <Stack spacing={2}>
                            <Stack spacing={2}>
                                <Typography level="body2">
                                    Prijava putem emaila i zaporke.
                                </Typography>
                                {passwordLoginConnected && (
                                    <Row spacing={2}>
                                        <Security className="size-8" />
                                        <Typography level="body1">
                                            Tvoj račun ima postavljenu zaporku.
                                        </Typography>
                                    </Row>
                                )}
                                {!passwordLoginConnected && (
                                    <Typography level="body3">
                                        Trenutno nemaš postavljenu zaporku.
                                    </Typography>
                                )}
                            </Stack>
                            <Stack spacing={1}>
                                {changePasswordSent ? (
                                    <Typography level="body2">
                                        Link za promjenu zaporke je poslan na
                                        tvoj email.
                                    </Typography>
                                ) : (
                                    <Button
                                        variant="outlined"
                                        onClick={handleSendChangePassword}
                                        loading={changePasswordPending}
                                        fullWidth
                                    >
                                        {passwordLoginConnected
                                            ? 'Promijeni zaporku'
                                            : 'Postavi zaporku'}
                                    </Button>
                                )}
                            </Stack>
                        </Stack>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent noHeader>
                        {userLoginsLoading && (
                            <Spinner
                                loading
                                className="size-5"
                                loadingLabel="Učitavanje prijava..."
                            />
                        )}
                        {!userLoginsLoading && (
                            <Stack spacing={3}>
                                <Stack spacing={3}>
                                    <Typography level="body2">
                                        Poveži svoj račun društvene mrežame za
                                        bržu i sigurniju prijavu.
                                    </Typography>
                                    {facebookConnected && (
                                        <Row spacing={2}>
                                            <CompanyFacebook className="size-8" />
                                            <Typography level="body1">
                                                Tvoj Facebook račun je povezan.
                                            </Typography>
                                        </Row>
                                    )}
                                    {googleConnected && (
                                        <Row spacing={2}>
                                            <CompanyGoogle className="size-8" />
                                            <Typography level="body1">
                                                Tvoj Google račun je povezan.
                                            </Typography>
                                        </Row>
                                    )}
                                    {!facebookConnected && !googleConnected && (
                                        <Typography level="body3">
                                            Trenutno nemaš povezanih računa.
                                        </Typography>
                                    )}
                                </Stack>
                                <Stack spacing={1}>
                                    {!facebookConnected && (
                                        <FacebookLoginButton
                                            href={`https://api.gredice.com/api/auth/facebook?timeZone=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)}`}
                                        />
                                    )}
                                    {!googleConnected && (
                                        <GoogleLoginButton
                                            href={`https://api.gredice.com/api/auth/google?timeZone=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)}`}
                                        />
                                    )}
                                </Stack>
                            </Stack>
                        )}
                    </CardContent>
                </Card>
            </Stack>
        </Stack>
    );
}
