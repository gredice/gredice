import { Navigate } from '@signalco/ui-icons';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@signalco/ui-primitives/Card';
import { cx } from '@signalco/ui-primitives/cx';
import Link from 'next/link';
import { CompanyInstagram } from '../../app/Footer';

export function InstagramCard() {
    return (
        <Link href="https://gredice.link/ig">
            <Card
                className={cx(
                    'h-full flex flex-row rounded-xl items-center justify-between max-w-md shadow hover:shadow-xl transition-all duration-300',
                    'bg-gradient-to-br from-red-50 to-orange-50 border-red-200 dark:from-red-200 dark:to-orange-200 dark:border-red-700',
                )}
            >
                <CardHeader className={cx('flex flex-row gap-4 items-center')}>
                    <div
                        className={cx(
                            'size-16 shrink-0 rounded-full flex items-center justify-center shadow-lg',
                            'bg-gradient-to-r from-[#833ab4] via-[#fd1d1d] to-[#fcb045]',
                        )}
                    >
                        <CompanyInstagram className="size-10 fill-white" />
                    </div>
                    <CardTitle className="text-lg leading-tight font-bold text-gray-800 max-w-xs mx-auto">
                        Prati nas na Instagramu
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-2">
                    <Navigate
                        className={cx('size-8 shrink-0', 'text-[#fcb045]')}
                    />
                </CardContent>
            </Card>
        </Link>
    );
}
