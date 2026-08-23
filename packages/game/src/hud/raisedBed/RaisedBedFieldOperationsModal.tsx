import { Hammer } from '@gredice/ui/icons';
import { GameModal } from '../../shared-ui/game-modal';
import { RaisedBedFieldOperationsTab } from './RaisedBedFieldOperationsTab';

export function RaisedBedFieldOperationsModal({
    gardenId,
    positionIndex,
    raisedBedId,
}: {
    gardenId: number;
    positionIndex: number;
    raisedBedId: number;
}) {
    const fieldLabel = `Polje ${positionIndex + 1}`;

    return (
        <GameModal
            className="max-w-xl overflow-x-hidden"
            headerDescription="Odaberi radnju za pripremu polja prije sjetve."
            headerIcon={<Hammer className="size-6" />}
            modal={false}
            title={`Radnje za ${fieldLabel.toLowerCase()}`}
            trigger={
                <button
                    type="button"
                    aria-label={`Otvori radnje za ${fieldLabel.toLowerCase()}`}
                    className="inline-flex size-8 items-center justify-center rounded-full border-2 border-white bg-white p-1 text-green-800 shadow-lg ring-1 ring-black/10 transition-transform hover:scale-105 hover:bg-gray-100 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-lime-700 dark:text-green-900"
                    data-empty-field-operations-trigger
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => event.stopPropagation()}
                    onPointerDown={(event) => event.stopPropagation()}
                    title={`Radnje za ${fieldLabel.toLowerCase()}`}
                >
                    <Hammer className="size-5" />
                </button>
            }
        >
            <RaisedBedFieldOperationsTab
                gardenId={gardenId}
                positionIndex={positionIndex}
                raisedBedId={raisedBedId}
            />
        </GameModal>
    );
}
