import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import type { DeliveryAddressData } from './DeliveryAddress';
import { DeliveryAddress } from './DeliveryAddress';
import { PhoneLink } from './PhoneLink';

export function DeliveryContactInfo({
    mode,
    address,
    location,
    showNotes = false,
    requestNotes,
}: {
    mode: string | null | undefined;
    address?: DeliveryAddressData | null;
    location?: { name?: string | null } | null;
    showNotes?: boolean;
    requestNotes?: string | null;
}) {
    const isDelivery = mode === 'delivery';

    return (
        <Stack spacing={0.25}>
            {isDelivery ? (
                <>
                    <Typography level="body2">
                        {address?.contactName || 'Nepoznat kontakt'}
                    </Typography>
                    <PhoneLink
                        phone={address?.phone}
                        fallback="Nije naveden broj telefona"
                        className="text-primary-600"
                    />
                    <DeliveryAddress
                        address={address}
                        compact
                        className="text-muted-foreground"
                    />
                </>
            ) : (
                <Typography level="body2">
                    {location?.name || 'Nepoznata lokacija'}
                </Typography>
            )}
            {showNotes && requestNotes && (
                <Typography level="body2" className="text-muted-foreground">
                    Napomena: {requestNotes}
                </Typography>
            )}
        </Stack>
    );
}
