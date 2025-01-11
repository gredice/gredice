import Link from 'next/link'
import { Mail } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@signalco/ui-primitives/Card'
import { Button } from '@signalco/ui-primitives/Button'
import { Stack } from '@signalco/ui-primitives/Stack'
import { Typography } from '@signalco/ui-primitives/Typography'

export default function ForgotPasswordEmailSentPage() {
    return (
        <div className="container flex items-center justify-center min-h-screen">
            <Card className="w-[350px]">
                <CardHeader>
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-[#2f6e40] mx-auto mb-4">
                        <Mail className="w-6 h-6 text-white" />
                    </div>
                    <CardTitle className="text-center">Email poslan</CardTitle>
                </CardHeader>
                <CardContent>
                    <Stack spacing={3}>
                        <Typography center semiBold className="text-[#2f6e40]">
                            Provjeri svoj email za nastavak promjene zaporke
                        </Typography>
                        <Typography level="body3" center>
                            Poslali smo ti link za promjene zaporke na tvoju email adresu. Molimo te provjeri svoj inbox i slijedi upute za promjenu zaporke.
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

