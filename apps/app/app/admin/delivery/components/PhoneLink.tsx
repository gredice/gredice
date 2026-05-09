import { Typography } from '@signalco/ui-primitives/Typography';

export function PhoneLink({
    phone,
    fallback = '-',
    className,
}: {
    phone: string | null | undefined;
    fallback?: string;
    className?: string;
}) {
    if (!phone) {
        return (
            <Typography level="body2" className={className}>
                {fallback}
            </Typography>
        );
    }

    return (
        <a href={`tel:${phone}`} className={className || 'text-primary-600'}>
            <Typography level="body2">{phone}</Typography>
        </a>
    );
}
