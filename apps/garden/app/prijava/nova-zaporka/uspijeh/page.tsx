import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent } from "@signalco/ui-primitives/Card";
import { Key } from 'lucide-react'
import { Stack } from '@signalco/ui-primitives/Stack';
import { Button } from '@signalco/ui-primitives/Button';
import { Typography } from '@signalco/ui-primitives/Typography';

export default function RegistrationSuccessfulPage() {
    return (
        <div className="flex items-center justify-center min-h-screen">
            <Card className="w-[350px]">
                <CardHeader>
                    <div className="flex items-center justify-center size-12 rounded-full bg-[#2f6e40] mx-auto mb-4">
                        <Key className="w-6 h-6 text-white" />
                    </div>
                    <CardTitle className="text-center">Promjena zaporke uspješna</CardTitle>
                </CardHeader>
                <CardContent>
                    <Stack spacing={3}>
                        <Typography level="body2" center>
                            Možeš se prijaviti s novom zaporkom.
                        </Typography>
                        <Button fullWidth variant='soft'>
                            <Link href="/">Prijava</Link>
                        </Button>
                    </Stack>
                </CardContent>
            </Card>
        </div>
    )
}

