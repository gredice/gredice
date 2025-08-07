import { OperationsList } from "./shared/OperationsList";

export function RaisedBedFieldOperationsTab({ gardenId, raisedBedId, positionIndex, plantSortId }: { gardenId: number; raisedBedId: number; positionIndex: number; plantSortId?: number }) {
    return (
        <OperationsList
            gardenId={gardenId}
            raisedBedId={raisedBedId}
            positionIndex={positionIndex}
            plantSortId={plantSortId}
            filterFunc={(operation) =>
                operation.attributes.application === 'plant'}
        />
    );
}