import { Suspense } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from "@signalco/ui-primitives/Card"
import { Key } from 'lucide-react'
import { ForgotPasswordForm } from './ForgotPasswordForm'

export default function ForgotPasswordPage() {
    return (
        <div className="container flex items-center justify-center min-h-screen">
            <Card className="w-[350px]">
                <CardHeader>
                    <div className="flex items-center justify-center size-12 rounded-full bg-[#2f6e40] mx-auto mb-4">
                        <Key className="w-6 h-6 text-white" />
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

