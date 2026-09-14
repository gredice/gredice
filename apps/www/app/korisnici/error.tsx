'use client';

import { Button } from '@gredice/ui/Button';

export default function UsersError({ reset }: { reset: () => void }) {
    return (
        <div className="mx-auto max-w-4xl py-10 sm:py-16">
            <h1 className="text-3xl font-semibold">Korisnici</h1>
            <p role="alert" className="my-4 text-muted-foreground">
                Podatke o korisnicima trenutačno nije moguće učitati.
            </p>
            <Button onClick={reset}>Pokušaj ponovno</Button>
        </div>
    );
}
