import { Card, CardHeader, CardTitle, CardContent } from "@signalco/ui-primitives/Card"
import { MailCheck } from 'lucide-react'
import { Stack } from '@signalco/ui-primitives/Stack'
import { Typography } from '@signalco/ui-primitives/Typography'
import { SendVerifyEmailButton } from "../../SendVerifyEmailButton"
import { Suspense } from "react"

export default function EmailVerificationSendPage() {
    return (
        <div className="flex items-center justify-center min-h-screen">
            <Card className="w-[350px] p-12">
                <CardHeader>
                    <div className="flex items-center justify-center size-12 rounded-full bg-[#2f6e40] mx-auto mb-4">
                        <MailCheck className="w-6 h-6 text-white" />
                    </div>
                    <CardTitle className='text-center'>Potvrda email adrese</CardTitle>
                </CardHeader>
                <CardContent>
                    <Stack spacing={3}>
                        <Typography level="body2" center>
                            Potrebna je potvrda email adrese za nastavak prijave.
                        </Typography>
                        <Suspense>
                            <SendVerifyEmailButton />
                        </Suspense>
                    </Stack>
                </CardContent>
            </Card>
        </div>
    )
}

