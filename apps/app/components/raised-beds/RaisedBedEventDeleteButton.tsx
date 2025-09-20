'use client';

import { Button } from '@signalco/ui-primitives/Button';
import { useTransition } from 'react';
import { deleteRaisedBedEventAction } from '../../app/(actions)/raisedBedEventsActions';

interface RaisedBedEventDeleteButtonProps {
    eventId: number;
    raisedBedId: number;
}

export function RaisedBedEventDeleteButton({
    eventId,
    raisedBedId,
}: RaisedBedEventDeleteButtonProps) {
    const [isPending, startTransition] = useTransition();

    const handleDelete = () => {
        if (!confirm('Da li ste sigurni da želite obrisati ovaj događaj?')) {
            return;
        }

        startTransition(async () => {
            try {
                const result = await deleteRaisedBedEventAction(
                    eventId,
                    raisedBedId,
                );

                if (!result.success) {
                    alert('Došlo je do greške pri brisanju događaja.');
                }
            } catch (error) {
                console.error('Error deleting raised bed event:', error);
                alert('Došlo je do greške pri brisanju događaja.');
            }
        });
    };

    return (
        <Button
            type="button"
            variant="plain"
            color="danger"
            size="sm"
            onClick={handleDelete}
            disabled={isPending}
        >
            {isPending ? 'Brisanje...' : 'Obriši'}
        </Button>
    );
}
