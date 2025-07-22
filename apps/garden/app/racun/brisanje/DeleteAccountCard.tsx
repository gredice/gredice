"use client";

import { client } from '@gredice/client';
import { Button } from '@signalco/ui-primitives/Button';
import { Card } from '@signalco/ui-primitives/Card';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

export function DeleteAccountCard() {
    const searchParams = useSearchParams();
    const token = searchParams.get('token');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<string | null>(null);

    async function handleDelete() {
        if (!token) {
            setResult('Nevažeća ili istekla poveznica - nepotpuno.');
            return;
        }

        setLoading(true);
        const res = await client().api.accounts.$delete({
            query: {
                token
            }
        });
        setLoading(false);
        if (res.ok || res.status === 404) {
            setResult('Brisanje računa je uspješno izvršeno.');
        } else {
            setResult('Greška prilikom brisanja računa. Osvježite stranicu i pokušajte ponovno.');
        }
    }

    return (
        <Card className="max-w-md mx-auto mt-10 p-6 text-center bg-background">
            <h2 className="text-xl font-bold mb-4">Potvrdi brisanje računa</h2>
            {result ? (
                <Typography level='body1'>{result}</Typography>
            ) : (
                <>
                    <Typography level='body1' gutterBottom>Ova radnja će trajno obrisati vaš račun i sve povezane podatke. Jeste li sigurni?</Typography>
                    <Button
                        className="bg-red-600 hover:bg-red-700"
                        onClick={handleDelete}
                        disabled={loading}
                        loading={loading}
                    >
                        {loading ? 'Brisanje...' : 'Obriši račun'}
                    </Button>
                </>
            )}
        </Card>
    );
}
