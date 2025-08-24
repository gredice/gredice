import type { PlantData } from '@gredice/client';
import {
    ArrowDownToLine,
    Droplet,
    Leaf,
    Ruler,
    Sprout,
    Sun,
    Tally3,
    Thermometer,
} from '@signalco/ui-icons';
import { AttributeCard } from '../../../components/attributes/DetailCard';

export function PlantAttributeCards({
    attributes,
}: {
    attributes: PlantData['attributes'] | undefined;
}) {
    return (
        <div className="grid grid-cols-2 gap-2">
            <AttributeCard
                icon={<Sun />}
                header="Svijetlost"
                value={
                    attributes?.light == null || Number.isNaN(attributes?.light)
                        ? '-'
                        : attributes?.light > 0.3
                          ? 'Polu-sjena'
                          : attributes?.light > 0.7
                            ? 'Sunce'
                            : 'Hlad'
                }
            />
            <AttributeCard
                icon={<Droplet />}
                header="Voda"
                value={attributes?.water}
            />
            <AttributeCard
                icon={<Tally3 className="size-6 rotate-90 mt-2" />}
                header="Zemlja"
                value={attributes?.soil}
            />
            <AttributeCard
                icon={<Leaf />}
                header="Nutrijenti"
                value={attributes?.nutrients}
            />
            <AttributeCard
                icon={<Ruler />}
                header="Razmak sijanja/sadnje"
                value={`${attributes?.seedingDistance || '-'} cm`}
            />
            <AttributeCard
                icon={<ArrowDownToLine />}
                header="Dubina sijanja"
                value={`${attributes?.seedingDepth || '-'} cm`}
            />
            <AttributeCard
                icon={<Sprout />}
                header="Klijanje"
                value={`${attributes?.germinationType || '-'}`}
            />
            <AttributeCard
                icon={<Thermometer />}
                header="Temperatura klijanja"
                value={`${attributes?.gernimationTemperature || '-'}°C`}
            />
        </div>
    );
}
