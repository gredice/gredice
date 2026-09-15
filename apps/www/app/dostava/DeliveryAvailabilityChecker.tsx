'use client';

import { getBrowserGrediceAppOrigin } from '@gredice/client';
import {
    deliveryPricePerKilometre,
    maximumDeliveryDistanceKilometres,
} from '@gredice/js/delivery';
import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@gredice/ui/Card';
import { Input } from '@gredice/ui/Input';
import { Check, MapPin, Search, Warning } from '@gredice/ui/icons';
import { type FormEvent, useState } from 'react';
import { formatPrice } from '../../lib/formatPrice';

type DeliveryAvailabilityResult = {
    distanceKilometres: number;
    formattedAddress: string;
    isAvailable: boolean;
    isFree: boolean;
    price: number;
};

type CheckerState =
    | { kind: 'idle' }
    | { kind: 'checking' }
    | { kind: 'result'; result: DeliveryAvailabilityResult }
    | { kind: 'error'; message: string };

const distanceFormatter = new Intl.NumberFormat('hr-HR', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
});

function publicDeliveryQuoteEndpoint() {
    return `${getBrowserGrediceAppOrigin('delivery')}/api/public/delivery-quote`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function parseDeliveryAvailabilityResult(
    value: unknown,
): DeliveryAvailabilityResult | null {
    if (!isRecord(value)) return null;
    const { distanceKilometres, formattedAddress, isAvailable, isFree, price } =
        value;
    if (
        typeof distanceKilometres !== 'number' ||
        typeof formattedAddress !== 'string' ||
        typeof isAvailable !== 'boolean' ||
        typeof isFree !== 'boolean' ||
        typeof price !== 'number'
    ) {
        return null;
    }

    return {
        distanceKilometres,
        formattedAddress,
        isAvailable,
        isFree,
        price,
    };
}

async function calculateDeliveryAvailability(address: string) {
    const response = await fetch(publicDeliveryQuoteEndpoint(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
    });
    const body: unknown = await response.json().catch(() => null);
    const result = parseDeliveryAvailabilityResult(body);
    if (response.ok && result) return result;

    if (response.status === 404) throw new Error('address-not-found');
    if (response.status === 429) throw new Error('rate-limited');
    throw new Error('service-unavailable');
}

function ResultAlert({ result }: { result: DeliveryAvailabilityResult }) {
    const distance = distanceFormatter.format(result.distanceKilometres);

    if (!result.isAvailable) {
        return (
            <Alert
                color="warning"
                startDecorator={<Warning className="size-5" />}
            >
                <strong>Dostava nije dostupna na ovu adresu.</strong>
                <p className="mt-1">
                    {result.formattedAddress} udaljena je približno {distance}{' '}
                    km vožnje od Gredice HQ-a. Dostavljamo do{' '}
                    {maximumDeliveryDistanceKilometres} km.
                </p>
            </Alert>
        );
    }

    if (result.isFree) {
        return (
            <Alert
                color="success"
                startDecorator={<Check className="size-5" />}
            >
                <strong>Dostava je dostupna i besplatna.</strong>
                <p className="mt-1">
                    {result.formattedAddress} nalazi se na području Grada
                    Zagreba.
                </p>
            </Alert>
        );
    }

    return (
        <Alert color="success" startDecorator={<Check className="size-5" />}>
            <strong>Dostava je dostupna.</strong>
            <p className="mt-1">
                {result.formattedAddress} udaljena je približno {distance} km
                vožnje. Procijenjena cijena je{' '}
                <strong>{formatPrice(result.price)}</strong> ({distance} km ×{' '}
                {formatPrice(deliveryPricePerKilometre)}/km).
            </p>
        </Alert>
    );
}

export function DeliveryAvailabilityChecker() {
    const [address, setAddress] = useState('');
    const [state, setState] = useState<CheckerState>({ kind: 'idle' });

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const normalizedAddress = address.trim();
        if (normalizedAddress.length < 5) return;

        setState({ kind: 'checking' });
        try {
            const result =
                await calculateDeliveryAvailability(normalizedAddress);
            setState({ kind: 'result', result });
        } catch (error) {
            const errorCode = error instanceof Error ? error.message : '';
            setState({
                kind: 'error',
                message:
                    errorCode === 'address-not-found'
                        ? 'Nismo pronašli tu adresu u Hrvatskoj. Provjeri ulicu, kućni broj i grad.'
                        : errorCode === 'rate-limited'
                          ? 'Napravio/la si previše provjera u kratkom vremenu. Pokušaj ponovno za minutu.'
                          : 'Trenutačno ne možemo izračunati dostavu. Pokušaj ponovno malo kasnije.',
            });
        }
    }

    return (
        <Card className="not-prose mb-4 border-tertiary border-b-4 p-3 sm:p-4">
            <CardHeader>
                <CardTitle className="text-xl">
                    📍 Provjeri dostupnost i cijenu dostave
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                    Upiši adresu u Hrvatskoj i odmah provjeri dostavljamo li do
                    tebe te koliko bi dostava koštala.
                </p>
            </CardHeader>
            <CardContent>
                <form
                    className="flex flex-col gap-3 sm:flex-row sm:items-end"
                    onSubmit={handleSubmit}
                >
                    <Input
                        autoComplete="street-address"
                        disabled={state.kind === 'checking'}
                        fullWidth
                        label="Adresa dostave"
                        maxLength={200}
                        minLength={5}
                        name="delivery-address"
                        onChange={(event) => {
                            setAddress(event.currentTarget.value);
                            if (state.kind !== 'idle') {
                                setState({ kind: 'idle' });
                            }
                        }}
                        placeholder="Ulica i kućni broj, grad"
                        required
                        startDecorator={
                            <MapPin className="ml-3 size-4 shrink-0 text-muted-foreground" />
                        }
                        value={address}
                    />
                    <Button
                        className="sm:shrink-0"
                        loading={state.kind === 'checking'}
                        startDecorator={<Search className="size-4" />}
                        type="submit"
                    >
                        Izračunaj
                    </Button>
                </form>
                <p className="mt-2 text-xs text-muted-foreground">
                    Adresa se koristi samo za ovaj izračun i ne sprema se.
                    Konačna cijena potvrđuje se prilikom naručivanja dostave.
                </p>
                <div aria-live="polite" className="mt-4">
                    {state.kind === 'result' ? (
                        <ResultAlert result={state.result} />
                    ) : null}
                    {state.kind === 'error' ? (
                        <Alert color="danger">{state.message}</Alert>
                    ) : null}
                </div>
            </CardContent>
        </Card>
    );
}
