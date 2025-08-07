import { Sun, Sprout, Leaf, Ruler, Tally3, Hourglass } from "@signalco/ui-icons"
import { AttributeCard } from "../../../components/attributes/DetailCard";
import { OperationData } from "@gredice/client";
import { JSX } from "react";
import { operationFrequencyLabel } from "../../biljke/[alias]/PlantOperations";

export function OperationAttributesCards({ attributes }: { attributes: OperationData['attributes'] | undefined }) {
    const applicationMap: Record<string, { label: string; icon: JSX.Element }> = {
        garden: { label: 'Vrt', icon: <Sun className="size-5 shrink-0" /> },
        raisedBedFull: { label: 'Cijela gredica', icon: <Tally3 className="size-5 shrink-0 rotate-90 mt-1" /> },
        raisedBed1m: { label: 'Gredica 1m²', icon: <Tally3 className="size-5 shrink-0 rotate-90 mt-1" /> },
        plant: { label: 'Biljka', icon: <Leaf className="size-5 shrink-0" /> },
    }

    return (
        <div className="grid grid-cols-2 gap-2">
            {attributes?.application && (
                <AttributeCard
                    icon={applicationMap[attributes.application]?.icon ?? <Ruler />}
                    header="Primjena"
                    value={applicationMap[attributes?.application]?.label ?? '-'} />
            )}
            <AttributeCard
                icon={<Hourglass />}
                header="Učestalost"
                value={operationFrequencyLabel(attributes?.frequency)} />
            <AttributeCard
                icon={<Sprout />}
                header="Stadij"
                value={attributes?.stage?.information?.label ?? '-'} />
        </div>
    )
}