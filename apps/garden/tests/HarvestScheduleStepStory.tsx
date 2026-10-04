import { Button } from '@gredice/ui/Button';
import { useState } from 'react';
import {
    type HarvestScheduleDateSelection,
    type HarvestScheduleItem,
    HarvestScheduleStep,
} from '../../../packages/game/src/shared-ui/delivery/HarvestScheduleStep';

const items = [
    {
        cartItemId: 71,
        operationLabel: 'Berba salate',
        raisedBedLabel: 'Gredica 3',
        plants: [
            {
                id: 901,
                label: 'Salata',
                maxHarvestDaysBeforeDelivery: 0,
            },
        ],
        scheduledDate: '2026-07-24',
        allowedFrom: '2026-07-24',
        allowedTo: '2026-07-24',
        valid: true,
    },
    {
        cartItemId: 72,
        operationLabel: 'Berba mrkve',
        raisedBedLabel: 'Gredica 4',
        plants: [
            {
                id: 902,
                label: 'Mrkva',
                maxHarvestDaysBeforeDelivery: 3,
            },
        ],
        scheduledDate: '2026-07-22',
        allowedFrom: '2026-07-21',
        allowedTo: '2026-07-24',
        valid: true,
    },
] satisfies HarvestScheduleItem[];

export function HarvestScheduleStepStory({
    invalid = false,
    withConfirmAction = false,
}: {
    invalid?: boolean;
    withConfirmAction?: boolean;
}) {
    const [selections, setSelections] = useState<
        readonly HarvestScheduleDateSelection[]
    >([]);
    const scenarioItems = invalid
        ? items.map((item) => ({
              ...item,
              scheduledDate: '2026-07-20',
              valid: false,
              validationReason: 'before_allowed_range',
          }))
        : items;

    return (
        <div className="w-[40rem] max-w-full p-5">
            <HarvestScheduleStep
                confirmAction={
                    withConfirmAction ? (
                        <Button>Postojeće plaćanje</Button>
                    ) : undefined
                }
                delivery={{
                    deliveryDate: '2026-07-24',
                    mode: 'delivery',
                    slotStartAt: '2026-07-24T15:00:00.000Z',
                    slotEndAt: '2026-07-24T17:00:00.000Z',
                    destinationLabel: 'Dom — Ilica 1, Zagreb',
                }}
                items={scenarioItems}
                onBack={() => {}}
                onConfirm={setSelections}
                onSelectedDatesChange={setSelections}
            />
            <output aria-label="Odabrani datumi branja">
                {JSON.stringify(selections)}
            </output>
        </div>
    );
}
