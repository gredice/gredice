'use client';

import { type ComponentProps, useEffect, useState } from 'react';
import { BulkAssignRaisedBedButton } from '../app/admin/schedule/BulkAssignRaisedBedButton';

type Operations = ComponentProps<
    typeof BulkAssignRaisedBedButton
>['operations'];

const bulkAssignTargetsEvent = 'bulk-assign-harness:operations';

export function BulkAssignRaisedBedHarness({
    initialOperations,
}: {
    initialOperations: Operations;
}) {
    const [operations, setOperations] = useState(initialOperations);
    const [submitted, setSubmitted] = useState<string[] | null>(null);

    useEffect(() => {
        const handleTargets = (event: Event) => {
            if (event instanceof CustomEvent) {
                setOperations(event.detail);
            }
        };
        window.addEventListener(bulkAssignTargetsEvent, handleTargets);
        return () =>
            window.removeEventListener(bulkAssignTargetsEvent, handleTargets);
    }, []);

    return (
        <div className="p-6">
            <BulkAssignRaisedBedButton
                physicalId="7"
                fields={[]}
                operations={operations}
                onSubmit={setSubmitted}
            />
            <output data-testid="submitted">
                {submitted ? `[${submitted.join(',')}]` : 'none'}
            </output>
        </div>
    );
}
