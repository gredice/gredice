import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent } from "@signalco/ui-primitives/Card";
import { Mail } from 'lucide-react'
import { Stack } from '@signalco/ui-primitives/Stack';
import { Button } from '@signalco/ui-primitives/Button';
import { Typography } from '@signalco/ui-primitives/Typography';

export default function RegistrationSuccessfulPage() {
    return (
        <div className="container flex items-center justify-center min-h-screen">
            <Card className="w-[350px]">
                <CardHeader>
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-[#2f6e40] mx-auto mb-4">
                        <Mail className="w-6 h-6 text-white" />
                    </div>
                    <CardTitle className="text-center">Registracija uspješna</CardTitle>
                </CardHeader>
                <CardContent>
                    <Stack spacing={3}>
                        <Typography center semiBold className="text-[#2f6e40]">
                            Provjeri svoj email za nastavak registracije
                        </Typography>
                        <Typography level="body3" center>
                            Poslali smo ti poveznicu za potvrdu registracije na tvoju email adresu. Molimo te provjeri svoj inbox i klikni na poveznicu kako bi potvrdili tvoj email.
                        </Typography>
                        <Button fullWidth variant='soft'>
                            <Link href="/">Povratak</Link>
                        </Button>
                    </Stack>
                </CardContent>
            </Card>
        </div>
    )
}

