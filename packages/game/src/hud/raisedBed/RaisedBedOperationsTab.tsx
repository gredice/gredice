import { OperationsList } from "./shared/OperationsList";

export function RaisedBedOperationsTab({ gardenId, raisedBedId }: { gardenId: number; raisedBedId?: number }) {
    return (
        <OperationsList
            gardenId={gardenId}
            raisedBedId={raisedBedId}
            filterFunc={(operation) =>
                operation.attributes.application === 'raisedBedFull' ||
                operation.attributes.application === 'raisedBed1m'}
        />
    )
}