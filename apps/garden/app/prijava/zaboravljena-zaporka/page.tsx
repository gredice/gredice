import { Card, CardContent, CardHeader, CardTitle } from '@gredice/ui/Card';
import { Password } from '@gredice/ui/icons';
import { Suspense } from 'react';
import { ForgotPasswordForm } from './ForgotPasswordForm';

export default function ForgotPasswordPage() {
    return (
        <div className="flex min-h-dvh items-center justify-center px-4 py-6">
            <Card className="w-full max-w-sm p-6 sm:p-10">
                <CardHeader>
                    <div className="flex items-center justify-center size-12 rounded-full bg-[#2f6e40] mx-auto mb-4">
                        <Password className="w-6 h-6 text-white" />
                    </div>
                    <CardTitle className="text-center">
                        Zaboravljena zaporka
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <Suspense>
                        <ForgotPasswordForm />
                    </Suspense>
                </CardContent>
            </Card>
        </div>
    );
}
