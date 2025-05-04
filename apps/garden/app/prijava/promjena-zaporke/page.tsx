import { Suspense } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from "@signalco/ui-primitives/Card"
import { ChangePasswordForm } from './ChangePasswordForm'
import { Password } from '@signalco/ui-icons'

export default function ChangePasswordPage() {
    return (
        <div className="flex items-center justify-center min-h-screen">
            <Card className="w-[350px] p-12">
                <CardHeader>
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-[#2f6e40] mx-auto mb-4">
                        <Password className="w-6 h-6 text-white" />
                    </div>
                    <CardTitle className="text-center">Promjena zaporke</CardTitle>
                </CardHeader>
                <CardContent>
                    <Suspense>
                        <ChangePasswordForm />
                    </Suspense>
                </CardContent>
            </Card>
        </div>
    )
}
