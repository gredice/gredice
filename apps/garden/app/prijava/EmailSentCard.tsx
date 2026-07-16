import { Button } from '@gredice/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@gredice/ui/Card';
import { Mail } from '@gredice/ui/icons';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';

export function EmailSentCard({
    purpose = 'password-reset',
}: {
    purpose?: 'email-verification' | 'password-reset';
}) {
    const isEmailVerification = purpose === 'email-verification';

    return (
        <Card className="w-full max-w-sm p-6 sm:p-10">
            <CardHeader>
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-[#2f6e40] mx-auto mb-4">
                    <Mail className="w-6 h-6 text-white" />
                </div>
                <CardTitle className="text-center">Email poslan</CardTitle>
            </CardHeader>
            <CardContent>
                <Stack spacing={6}>
                    <Typography center semiBold className="text-[#2f6e40]">
                        {isEmailVerification
                            ? 'Provjeri svoj email za potvrdu email adrese'
                            : 'Provjeri svoj email za nastavak promjene zaporke'}
                    </Typography>
                    <Typography level="body3" center>
                        {isEmailVerification
                            ? 'Poslali smo ti poveznicu za potvrdu email adrese. Provjeri svoj inbox i slijedi upute za potvrdu.'
                            : 'Poslali smo ti poveznicu za promjenu zaporke na tvoju email adresu. Provjeri svoj inbox i slijedi upute za promjenu zaporke.'}
                    </Typography>
                    <Button href="/" fullWidth variant="soft" size="lg">
                        Povratak
                    </Button>
                </Stack>
            </CardContent>
        </Card>
    );
}
