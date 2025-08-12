'use client';

import { Card, CardContent } from "@signalco/ui-primitives/Card";
import { Stack } from "@signalco/ui-primitives/Stack";
import { SelectItems } from "@signalco/ui-primitives/SelectItems";
import { Input } from "@signalco/ui-primitives/Input";
import { Button } from "@signalco/ui-primitives/Button";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function DeliveryRequestsFilters() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [filters, setFilters] = useState({
        status: searchParams.get('status') || '',
        mode: searchParams.get('mode') || '',
        fromDate: searchParams.get('fromDate') || '',
        toDate: searchParams.get('toDate') || ''
    });

    const handleFilterChange = (key: string, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const applyFilters = () => {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
            if (value) params.set(key, value);
        });

        router.push(`/admin/delivery/requests?${params.toString()}`);
    };

    const clearFilters = () => {
        setFilters({
            status: '',
            mode: '',
            fromDate: '',
            toDate: ''
        });
        router.push('/admin/delivery/requests');
    };

    return (
        <Card>
            <CardContent>
                <Stack spacing={3}>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <SelectItems
                            variant="outlined"
                            placeholder="Filtriraj po statusu"
                            value={filters.status}
                            onValueChange={(value) => handleFilterChange('status', value)}
                            items={[
                                { value: '', label: 'Svi statusi' },
                                { value: 'pending', label: 'Na čekanju' },
                                { value: 'confirmed', label: 'Potvrđen' },
                                { value: 'preparing', label: 'U pripremi' },
                                { value: 'ready', label: 'Spreman' },
                                { value: 'fulfilled', label: 'Ispunjen' },
                                { value: 'cancelled', label: 'Otkazan' }
                            ]}
                        />

                        <SelectItems
                            variant="outlined"
                            placeholder="Filtriraj po načinu"
                            value={filters.mode}
                            onValueChange={(value) => handleFilterChange('mode', value)}
                            items={[
                                { value: '', label: 'Svi načini' },
                                { value: 'delivery', label: 'Dostava' },
                                { value: 'pickup', label: 'Preuzimanje' }
                            ]}
                        />

                        <Input
                            type="date"
                            label="Od datuma"
                            value={filters.fromDate}
                            onChange={(e) => handleFilterChange('fromDate', e.target.value)}
                        />

                        <Input
                            type="date"
                            label="Do datuma"
                            value={filters.toDate}
                            onChange={(e) => handleFilterChange('toDate', e.target.value)}
                        />
                    </div>

                    <div className="flex gap-2">
                        <Button onClick={applyFilters}>
                            Primijeniti filtere
                        </Button>
                        <Button variant="outlined" onClick={clearFilters}>
                            Očisti filtere
                        </Button>
                    </div>
                </Stack>
            </CardContent>
        </Card>
    );
}
