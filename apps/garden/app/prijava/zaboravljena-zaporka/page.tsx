import { Suspense } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from "@signalco/ui-primitives/Card"
import { ForgotPasswordForm } from './ForgotPasswordForm'
import { Password } from '@signalco/ui-icons'

export default function ForgotPasswordPage() {
    return (
        <div className="flex items-center justify-center min-h-screen">
            <Card className="w-[350px] p-12">
                <CardHeader>
                    <div className="flex items-center justify-center size-12 rounded-full bg-[#2f6e40] mx-auto mb-4">
                        <Password className="w-6 h-6 text-white" />
                    </div>
                    <CardTitle className='text-center'>Zaboravljena zaporka</CardTitle>
                </CardHeader>
                <CardContent>
                    <Suspense>
                        <ForgotPasswordForm />
                    </Suspense>
                </CardContent>
            </Card>
        </div>
    )
}

