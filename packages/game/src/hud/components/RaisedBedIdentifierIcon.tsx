import { RaisedBedIcon } from '@gredice/ui/RaisedBedIcon';

export function RaisedBedIdentifierIcon({
    physicalId,
}: {
    physicalId?: string | number | null;
}) {
    return (
        <div className="relative h-6 min-w-4" title="Identifikator gredice">
            <span className="absolute -top-2 left-1/2 -translate-x-1/2 font-bold">
                {physicalId}
            </span>
            <RaisedBedIcon className="absolute top-1 left-1/2 -translate-x-1/2 size-6" />
        </div>
    );
}
