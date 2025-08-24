import { CompanyFacebook, Navigate } from '@signalco/ui-icons';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@signalco/ui-primitives/Card';
import { cx } from '@signalco/ui-primitives/cx';
import Link from 'next/link';

export function FacebookCard() {
    return (
        <Link href="https://gredice.link/fb">
            <Card
                className={cx(
                    'h-full flex flex-row rounded-xl items-center justify-between max-w-md shadow hover:shadow-xl transition-all duration-300',
                    'bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200',
                )}
            >
                <CardHeader className={cx('flex flex-row gap-4 items-center')}>
                    <div
                        className={cx(
                            'size-16 shrink-0 rounded-full flex items-center justify-center shadow-lg',
                            'bg-[#1877F2]',
                        )}
                    >
                        <CompanyFacebook className="size-10 fill-white" />
                    </div>
                    <CardTitle className="text-lg leading-tight font-bold text-gray-800 max-w-xs mx-auto">
                        Prati nas na Facebooku
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-2">
                    <Navigate
                        className={cx('size-8 shrink-0', 'text-blue-600')}
                    />
                </CardContent>
            </Card>
        </Link>
    );
}
