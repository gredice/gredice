'use client';

import { Close } from '@signalco/ui-icons';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { Input } from '@signalco/ui-primitives/Input';
import { SelectItems } from '@signalco/ui-primitives/SelectItems';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

export function DeliveryRequestsFilters() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [filters, setFilters] = useState({
        status: searchParams.get('status') || 'all',
        mode: searchParams.get('mode') || 'all',
        fromDate: searchParams.get('fromDate') || '',
        toDate: searchParams.get('toDate') || '',
    });

    const handleFilterChange = (key: string, value: string) => {
        const newFilters = { ...filters, [key]: value };
        setFilters(newFilters);

        // Apply filters immediately
        const params = new URLSearchParams();
        Object.entries(newFilters).forEach(([key, value]) => {
            if (value && value !== 'all') params.set(key, value);
        });

        router.push(`/admin/delivery/requests?${params.toString()}`);
    };

    const clearFilters = () => {
        const clearedFilters = {
            status: 'all',
            mode: 'all',
            fromDate: '',
            toDate: '',
        };
        setFilters(clearedFilters);
        router.push('/admin/delivery/requests');
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
            <SelectItems
                variant="outlined"
                placeholder="Filtriraj po statusu"
                value={filters.status}
                onValueChange={(value) => handleFilterChange('status', value)}
                items={[
                    { value: 'all', label: 'Svi statusi' },
                    { value: 'pending', label: 'Na čekanju' },
                    { value: 'confirmed', label: 'Potvrđen' },
                    { value: 'preparing', label: 'U pripremi' },
                    { value: 'ready', label: 'Spreman' },
                    { value: 'fulfilled', label: 'Ispunjen' },
                    { value: 'cancelled', label: 'Otkazan' },
                ]}
            />

            <SelectItems
                variant="outlined"
                placeholder="Filtriraj po načinu"
                value={filters.mode}
                onValueChange={(value) => handleFilterChange('mode', value)}
                items={[
                    { value: 'all', label: 'Svi načini' },
                    { value: 'delivery', label: 'Dostava' },
                    { value: 'pickup', label: 'Preuzimanje' },
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

            <IconButton
                variant="outlined"
                onClick={clearFilters}
                title="Očisti filtere"
                aria-label="Očisti filtere"
            >
                <Close />
            </IconButton>
        </div>
    );
}
