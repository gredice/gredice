import { Card, CardContent, CardHeader, CardTitle } from '@gredice/ui/Card';
import { MailCheck } from '@gredice/ui/icons';
import { Suspense } from 'react';
import { VerifyEmail } from './VerifyEmail';

export default function EmailVerificationPage() {
    return (
        <div className="flex items-center justify-center min-h-screen">
            <Card className="w-[350px] p-12">
                <CardHeader>
                    <div className="flex items-center justify-center size-12 rounded-full bg-[#2f6e40] mx-auto mb-4">
                        <MailCheck className="w-6 h-6 text-white" />
                    </div>
                    <CardTitle className="text-center">
                        Potvrda email adrese
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <Suspense>
                        <VerifyEmail />
                    </Suspense>
                </CardContent>
            </Card>
        </div>
    );
}
