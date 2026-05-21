import {
    Bank,
    Calendar,
    Channel,
    Check,
    Code,
    Euro,
    ExternalLink,
    Fence,
    File,
    FileText,
    Globe,
    Hammer,
    Hash,
    Info,
    Link as LinkIcon,
    Mail,
    MapPin,
    Paperclip,
    Security,
    ShoppingCart,
    Snowflake,
    Sprout,
    Stack,
    Tally3,
    Text,
    ToggleRight,
    User,
    UserCircle,
    Wallet,
    Warning,
} from '@gredice/ui/icons';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { cx } from '@gredice/ui/utils';
import type { ReactNode } from 'react';

export type EntityDetailsPropertyListItem = {
    id: string;
    label: string;
    value: Date | boolean | string | number | ReactNode | null | undefined;
    mono?: boolean;
    visual?: ReactNode;
};

export function EntityDetailsPropertyList({
    items,
}: {
    items: EntityDetailsPropertyListItem[];
}) {
    return (
        <dl className="min-w-0">
            {items.map((item) => {
                const visual = item.visual ?? defaultPropertyVisual(item);

                return (
                    <div
                        key={item.id}
                        className="grid min-w-0 grid-cols-[minmax(5.5rem,0.85fr)_minmax(0,1.15fr)] items-center gap-2 px-4 py-1.5 text-sm"
                    >
                        <dt className="flex min-h-6 min-w-0 items-center gap-2 text-muted-foreground leading-5">
                            {visual && (
                                <span
                                    className="flex shrink-0 items-center justify-center text-muted-foreground"
                                    aria-hidden
                                >
                                    {visual}
                                </span>
                            )}
                            <span className="min-w-0 truncate">
                                {item.label}
                            </span>
                        </dt>
                        <dd className="flex min-h-6 min-w-0 items-center text-foreground leading-5">
                            <div
                                className={cx(
                                    'block min-w-0 max-w-full leading-5',
                                    isCompactValue(item.value) &&
                                        'truncate overflow-hidden',
                                    item.mono && 'font-mono',
                                )}
                                title={
                                    isCompactValue(item.value)
                                        ? String(item.value)
                                        : undefined
                                }
                            >
                                {renderPropertyValue(item.value)}
                            </div>
                        </dd>
                    </div>
                );
            })}
        </dl>
    );
}

const propertyIconClassName = 'size-4';

function defaultPropertyVisual(item: EntityDetailsPropertyListItem): ReactNode {
    const id = item.id.toLowerCase();
    const key = `${id} ${item.label.toLowerCase()}`;

    if (typeof item.value === 'boolean' || matches(key, ['deleted'])) {
        return <ToggleRight className={propertyIconClassName} />;
    }

    if (
        item.value instanceof Date ||
        isDateId(id) ||
        matches(key, [
            'ažur',
            'azur',
            'date',
            'datum',
            'kreir',
            'last login',
            'last sign',
            'pokušaj',
            'pokusaj',
            'prijav',
            'scheduled',
            'sent',
            'zakazan',
        ])
    ) {
        return <Calendar className={propertyIconClassName} />;
    }

    if (matches(key, ['email', 'mail'])) {
        return <Mail className={propertyIconClassName} />;
    }

    if (matches(key, ['avatar'])) {
        return <UserCircle className={propertyIconClassName} />;
    }

    if (matches(key, ['korisnik', 'korisnic', 'user'])) {
        return <User className={propertyIconClassName} />;
    }

    if (matches(key, ['role', 'security', 'uloga']) || item.id === 'role') {
        return <Security className={propertyIconClassName} />;
    }

    if (
        matches(key, [
            'greška',
            'greska',
            'error',
            'fail',
            'failed',
            'failure',
            'obrisan',
            'obrisana',
            'otkaz',
            'cancel',
        ])
    ) {
        return <Warning className={propertyIconClassName} />;
    }

    if (matches(key, ['status', 'verified', 'verific'])) {
        return <Check className={propertyIconClassName} />;
    }

    if (
        matches(key, ['profil', 'profile', 'external', 'javni']) ||
        item.id === 'publicProfile'
    ) {
        return <ExternalLink className={propertyIconClassName} />;
    }

    if (matches(key, ['link', 'path', 'putanja', 'slug', 'url'])) {
        return <LinkIcon className={propertyIconClassName} />;
    }

    if (matches(key, ['transakcija', 'transaction'])) {
        return <Wallet className={propertyIconClassName} />;
    }

    if (
        matches(key, [
            'amount',
            'currency',
            'eur',
            'iznos',
            'osnovica',
            'pdv',
            'total',
            'ukupno',
            'valuta',
        ])
    ) {
        return <Euro className={propertyIconClassName} />;
    }

    if (matches(key, ['account', 'račun', 'racun'])) {
        return <Bank className={propertyIconClassName} />;
    }

    if (matches(key, ['invoice', 'napomen', 'notes', 'ponuda', 'receipt'])) {
        return <FileText className={propertyIconClassName} />;
    }

    if (
        matches(key, [
            'broj',
            'count',
            'komad',
            'količina',
            'kolicina',
            'quantity',
            'serial',
            'serijski',
            'stavki',
        ])
    ) {
        return <Tally3 className={propertyIconClassName} />;
    }

    if (matches(key, ['košar', 'kosar', 'cart'])) {
        return <ShoppingCart className={propertyIconClassName} />;
    }

    if (matches(key, ['inventory', 'ruksak', 'zali'])) {
        return <Stack className={propertyIconClassName} />;
    }

    if (matches(key, ['operation', 'radnj'])) {
        return <Hammer className={propertyIconClassName} />;
    }

    if (matches(key, ['farma', 'farm'])) {
        return <Fence className={propertyIconClassName} />;
    }

    if (matches(key, ['garden', 'vrt'])) {
        return <Sprout className={propertyIconClassName} />;
    }

    if (matches(key, ['field', 'polje'])) {
        return <MapPin className={propertyIconClassName} />;
    }

    if (matches(key, ['gredic', 'raised-bed'])) {
        return <Fence className={propertyIconClassName} />;
    }

    if (
        matches(key, [
            'address',
            'adresa',
            'latitude',
            'longitude',
            'location',
            'lokacija',
        ])
    ) {
        return <MapPin className={propertyIconClassName} />;
    }

    if (matches(key, ['channel', 'kanal', 'slack'])) {
        return <Channel className={propertyIconClassName} />;
    }

    if (matches(key, ['snijeg', 'snow'])) {
        return <Snowflake className={propertyIconClassName} />;
    }

    if (matches(key, ['time-zone', 'timezone', 'zona'])) {
        return <Globe className={propertyIconClassName} />;
    }

    if (matches(key, ['image', 'meta', 'slika'])) {
        return <File className={propertyIconClassName} />;
    }

    if (
        matches(key, [
            'description',
            'name',
            'naziv',
            'opis',
            'title',
            'naslov',
        ])
    ) {
        return <Text className={propertyIconClassName} />;
    }

    if (matches(key, ['attachment', 'prilog'])) {
        return <Paperclip className={propertyIconClassName} />;
    }

    if (matches(key, ['code', 'kod'])) {
        return <Code className={propertyIconClassName} />;
    }

    if (matches(key, ['id'])) {
        return <Hash className={propertyIconClassName} />;
    }

    return <Info className={propertyIconClassName} />;
}

function matches(value: string, fragments: string[]) {
    return fragments.some((fragment) => value.includes(fragment));
}

function isDateId(id: string) {
    return matches(id, [
        'cancelledat',
        'canceledat',
        'completedat',
        'connectedat',
        'createdat',
        'scheduledat',
        'sentat',
        'updatedat',
        'verifiedat',
    ]);
}

function renderPropertyValue(value: EntityDetailsPropertyListItem['value']) {
    if (value instanceof Date) {
        return <LocalDateTime>{value}</LocalDateTime>;
    }

    if (typeof value === 'boolean') {
        return renderBooleanValueToggle(value);
    }

    return value ?? '-';
}

function isCompactValue(value: EntityDetailsPropertyListItem['value']) {
    return typeof value === 'string' || typeof value === 'number';
}

function renderBooleanValueToggle(value: boolean) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={value}
            disabled
            className={cx(
                'relative flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors disabled:cursor-default disabled:opacity-100',
                value
                    ? 'border-primary/60 bg-primary'
                    : 'border-border bg-muted/70',
            )}
        >
            <span
                className={cx(
                    'inline-block size-4 rounded-full shadow-sm transition-transform',
                    value ? 'bg-primary-foreground' : 'bg-muted-foreground',
                    value ? 'translate-x-4' : 'translate-x-0.5',
                )}
            />
            <span className="sr-only">{value ? 'Da' : 'Ne'}</span>
        </button>
    );
}
