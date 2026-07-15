'use client';

import { useRef, useState } from 'react';
import { DeliveryExceptionSheet } from '../components/DeliveryExceptionSheet';
import type { DeliveryStopSummary } from '../lib/deliveryDashboardTypes';
import type {
    DeliveryExceptionMutation,
    DeliveryExceptionSubmitResult,
} from '../lib/deliveryExceptionPresentation';
import { bulkExceptionStop } from './deliveryRecoveryFixtures';

type ResponseStatus = DeliveryExceptionSubmitResult['status'];

function responseFor(status: ResponseStatus): DeliveryExceptionSubmitResult {
    if (status === 'saved') return { status };
    if (status === 'review-required') {
        return {
            status,
            message:
                'Ruta se promijenila. Pregledaj odabir prije ponovnog slanja.',
        };
    }
    return {
        status,
        message: 'Veza s poslužiteljem je prekinuta. Pokušaj ponovno.',
    };
}

export function DeliveryExceptionSheetStory({
    routeRevision = 8,
    responseStatuses = ['saved'],
    stop = bulkExceptionStop,
}: {
    routeRevision?: number;
    responseStatuses?: readonly ResponseStatus[];
    stop?: DeliveryStopSummary;
}) {
    const nextSubmissionRef = useRef(0);
    const [submissions, setSubmissions] = useState<
        Array<{ sequence: number; body: string }>
    >([]);

    async function submitException(
        mutation: DeliveryExceptionMutation,
    ): Promise<DeliveryExceptionSubmitResult> {
        const sequence = nextSubmissionRef.current;
        nextSubmissionRef.current += 1;
        setSubmissions((current) => [
            ...current,
            { sequence, body: JSON.stringify(mutation) },
        ]);

        const fallbackStatus = responseStatuses.at(-1) ?? 'saved';
        return responseFor(responseStatuses[sequence] ?? fallbackStatus);
    }

    return (
        <div className="space-y-4 p-4">
            <DeliveryExceptionSheet
                runId="run-component-4127"
                routeRevision={routeRevision}
                stop={stop}
                disabled={false}
                onSubmit={submitException}
            />
            <output data-testid="delivery-exception-route-revision">
                {routeRevision}
            </output>
            <ol aria-label="Poslane promjene dostave">
                {submissions.map((submission) => (
                    <li key={submission.sequence}>
                        <output
                            data-testid={`delivery-exception-submission-${submission.sequence}`}
                        >
                            {submission.body}
                        </output>
                    </li>
                ))}
            </ol>
        </div>
    );
}
