'use client';

import { SelectItems } from '@signalco/ui-primitives/SelectItems';
import { useRouter, useSearchParams } from 'next/navigation';

export function TimeSlotsFilters() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const status = searchParams.get('status') || 'active';

    const handleChange = (value: string) => {
        const params = new URLSearchParams(searchParams.toString());
        if (value === 'active') {
            params.delete('status');
        } else {
            params.set('status', value);
        }
        const query = params.toString();
        router.push(`/admin/delivery/slots${query ? `?${query}` : ''}`);
    };

    return (
        <SelectItems
            variant="outlined"
            placeholder="Filtriraj po statusu"
            value={status}
            onValueChange={handleChange}
            items={[
                { value: 'active', label: 'Aktivni' },
                { value: 'all', label: 'Svi' },
            ]}
        />
    );
}
