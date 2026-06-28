import { Chip } from '@gredice/ui/Chip';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { formatDeliveryAddress, PhoneLink } from '../components';
import type { DeliveryRequestDetails } from './DeliveryRequestListTypes';

function cleanText(value: string | null | undefined) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
}

function locationAddressFields(
    location: NonNullable<DeliveryRequestDetails['location']>,
) {
    return [
        { key: 'street1', value: cleanText(location.street1) },
        { key: 'street2', value: cleanText(location.street2) },
        {
            key: 'postal-city',
            value: [cleanText(location.postalCode), cleanText(location.city)]
                .filter(Boolean)
                .join(' '),
        },
        { key: 'country', value: cleanText(location.countryCode) },
    ].filter((field) => field.value);
}

function deliveryAddressFields(
    address: NonNullable<DeliveryRequestDetails['address']>,
) {
    return [
        { key: 'street1', value: cleanText(address.street1) },
        { key: 'street2', value: cleanText(address.street2) },
        {
            key: 'postal-city',
            value: [cleanText(address.postalCode), cleanText(address.city)]
                .filter(Boolean)
                .join(' '),
        },
        { key: 'country', value: cleanText(address.countryCode) },
    ].filter((field) => field.value);
}

function mapsHref(value: string) {
    return `https://www.google.com/maps/dir//${encodeURIComponent(value)}`;
}

export function getDeliveryRequestDestinationTitle(
    request: DeliveryRequestDetails,
) {
    if (request.mode === 'pickup') {
        return cleanText(request.location?.name) ?? 'Nepoznata lokacija';
    }

    return cleanText(request.address?.contactName) ?? 'Nepoznat kontakt';
}

export function DeliveryDestinationDetails({
    request,
}: {
    request: DeliveryRequestDetails;
}) {
    const notes = [
        { label: 'Napomena zahtjeva', value: cleanText(request.requestNotes) },
        { label: 'Napomena dostave', value: cleanText(request.deliveryNotes) },
        { label: 'Razlog otkazivanja', value: cleanText(request.cancelReason) },
    ].filter((note) => note.value);

    if (request.mode === 'pickup') {
        const location = request.location;
        if (!location) {
            return (
                <Typography level="body2" className="text-muted-foreground">
                    Nema podataka o lokaciji preuzimanja
                </Typography>
            );
        }

        const fields = locationAddressFields(location);
        const address = fields.map((field) => field.value).join(', ');

        return (
            <Stack spacing={0.75} className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                    {location.isActive === false ? (
                        <Chip color="neutral" size="sm" variant="outlined">
                            Neaktivna lokacija
                        </Chip>
                    ) : null}
                </div>
                {fields.length ? (
                    <a
                        href={mapsHref(address)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-primary"
                    >
                        {fields.map((field) => (
                            <Typography
                                key={field.key}
                                level="body2"
                                className="text-inherit"
                            >
                                {field.value}
                            </Typography>
                        ))}
                    </a>
                ) : null}
                {notes.map((note) => (
                    <Typography
                        key={note.label}
                        level="body3"
                        className="text-muted-foreground"
                    >
                        {note.label}: {note.value}
                    </Typography>
                ))}
            </Stack>
        );
    }

    const address = request.address;
    if (!address) {
        return (
            <Typography level="body2" className="text-muted-foreground">
                Nema podataka o adresi dostave
            </Typography>
        );
    }

    const addressLine = formatDeliveryAddress(address);
    const fields = deliveryAddressFields(address);

    return (
        <Stack spacing={0.75} className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
                {cleanText(address.label) ? (
                    <Chip color="neutral" size="sm" variant="outlined">
                        {address.label}
                    </Chip>
                ) : null}
                {address.isDefault ? (
                    <Chip color="info" size="sm" variant="soft">
                        Zadana adresa
                    </Chip>
                ) : null}
            </div>
            <PhoneLink
                phone={address.phone}
                fallback="Nije naveden broj telefona"
                className="text-primary-600"
            />
            {addressLine ? (
                <a
                    href={mapsHref(addressLine)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-primary"
                >
                    {fields.map((field) => (
                        <Typography
                            key={field.key}
                            level="body2"
                            className="text-inherit"
                        >
                            {field.value}
                        </Typography>
                    ))}
                </a>
            ) : null}
            {notes.map((note) => (
                <Typography
                    key={note.label}
                    level="body3"
                    className="text-muted-foreground"
                >
                    {note.label}: {note.value}
                </Typography>
            ))}
        </Stack>
    );
}
