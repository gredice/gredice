import { Button } from '@gredice/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@gredice/ui/Card';
import { Mail } from '@gredice/ui/icons';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';

export default function RegistrationSuccessfulPage() {
    return (
        <div className="flex items-center justify-center min-h-screen">
            <Card className="w-[350px] p-12">
                <CardHeader>
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-[#2f6e40] mx-auto mb-4">
                        <Mail className="size-6 text-white" />
                    </div>
                    <CardTitle className="text-center">
                        Registracija uspješna
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <Stack spacing={6}>
                        <Typography center semiBold className="text-[#2f6e40]">
                            Provjeri svoj email za nastavak registracije
                        </Typography>
                        <Typography level="body3" center>
                            Poslali smo ti poveznicu za potvrdu registracije na
                            tvoju email adresu. Molimo te provjeri svoj inbox i
                            klikni na poveznicu kako bi potvrdili tvoj email.
                        </Typography>
                        <Button href="/" fullWidth variant="soft">
                            Povratak
                        </Button>
                    </Stack>
                </CardContent>
            </Card>
        </div>
    );
}
