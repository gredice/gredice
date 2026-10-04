'use client';

import { useState } from 'react';
import { HarvestTraceScanner } from '../components/HarvestTraceScanner';

function scanResult(value: string) {
    if (value.includes('tomato')) {
        return {
            status: 'selected' as const,
            tracePath: '/trag/tomato-quality-4146',
            plantName: 'Rajčica Roma',
            contactName: 'Ana Anić',
            deliveryCount: 2,
            newlySelectedCount: 2,
            nextSelectedRequestIds: ['request-tomato-1', 'request-tomato-2'],
        };
    }
    if (value.includes('basil')) {
        return {
            status: 'selected' as const,
            tracePath: '/trag/basil-quality-4146',
            plantName: 'Bosiljak Genovese',
            contactName: 'Borna Barić',
            deliveryCount: 1,
            newlySelectedCount: 1,
            nextSelectedRequestIds: ['request-basil'],
        };
    }
    return { status: 'invalid' as const };
}

export function HarvestTraceScannerStory() {
    const [calls, setCalls] = useState<string[]>([]);
    const [selectedCount, setSelectedCount] = useState(0);

    return (
        <main className="p-4">
            <output data-testid="scanner-calls">{calls.join('|')}</output>
            <HarvestTraceScanner
                variant="pickup"
                availableTraceCount={3}
                completedTraceCount={selectedCount}
                disabled={false}
                onScan={async (value) => {
                    setCalls((current) => [...current, value]);
                    const result = scanResult(value);
                    if (result.status === 'selected') {
                        setSelectedCount(
                            (current) => current + result.deliveryCount,
                        );
                    }
                    return result;
                }}
            />
        </main>
    );
}
