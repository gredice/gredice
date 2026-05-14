import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';

export interface DeliveryAddressData {
    street1?: string | null;
    street2?: string | null;
    city?: string | null;
    postalCode?: string | null;
    contactName?: string | null;
    phone?: string | null;
}

export function formatDeliveryAddress(
    address: DeliveryAddressData | null | undefined,
): string {
    if (!address) {
        return '';
    }

    return [address.street1, address.street2, address.city, address.postalCode]
        .filter(Boolean)
        .join(', ');
}

export function formatDeliveryAddressCompact(
    address: DeliveryAddressData | null | undefined,
): string | undefined {
    if (!address) {
        return undefined;
    }

    const lines = [
        [address.street1, address.street2].filter(Boolean).join(', '),
        [address.postalCode, address.city].filter(Boolean).join(' '),
    ]
        .map((line) => line.trim())
        .filter(Boolean);

    return lines.length > 0 ? lines.join(' • ') : undefined;
}

export function DeliveryAddress({
    address,
    showContactInfo = false,
    linkToGoogleMaps = false,
    compact = false,
    className,
}: {
    address: DeliveryAddressData | null | undefined;
    showContactInfo?: boolean;
    linkToGoogleMaps?: boolean;
    compact?: boolean;
    className?: string;
}) {
    if (!address) {
        return (
            <Typography level="body2" className={className}>
                -
            </Typography>
        );
    }

    const addressString = formatDeliveryAddress(address);
    const googleMapsUri = `https://www.google.com/maps/dir//${encodeURIComponent(addressString)}`;

    if (compact) {
        const compactAddress = formatDeliveryAddressCompact(address);
        return (
            <Typography level="body2" className={className}>
                {compactAddress || '-'}
            </Typography>
        );
    }

    const addressContent = (
        <Stack spacing={0}>
            {showContactInfo && (
                <Typography level="body2">
                    {address.contactName || '-'}
                </Typography>
            )}
            <Typography level="body2">{address.street1 || '-'}</Typography>
            {address.street2 && (
                <Typography level="body2">{address.street2}</Typography>
            )}
            <Typography level="body2">
                {address.postalCode || '-'}, {address.city || '-'}
            </Typography>
        </Stack>
    );

    if (linkToGoogleMaps) {
        return (
            <a
                href={googleMapsUri}
                target="_blank"
                rel="noopener noreferrer"
                className={className}
            >
                {addressContent}
            </a>
        );
    }

    return <div className={className}>{addressContent}</div>;
}
