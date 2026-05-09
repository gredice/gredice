import type { PlantData } from '@gredice/client';
import { calculatePlantsPerField, FIELD_SIZE_LABEL } from '@gredice/js/plants';
import { PlantGridIcon } from '@gredice/ui/GridIcons';
import {
    ArrowDownToLine,
    Ruler,
    Sprout,
    Thermometer,
    Timer,
} from '@signalco/ui-icons';
import { AttributeCard } from '../../../components/attributes/DetailCard';
import { KnownPages } from '../../../src/KnownPages';

export function SowingAttributeCards({
    attributes,
}: {
    attributes: PlantData['attributes'] | undefined;
}) {
    const { totalPlants } = calculatePlantsPerField(
        attributes?.seedingDistance,
    );
    const formatDayRange = (
        min?: number | null,
        max?: number | null,
    ): string => {
        if (min == null && max == null) {
            return '-';
        }
        if (min != null && max != null) {
            if (min === max) {
                return `${min} ${min === 1 ? 'dan' : 'dana'}`;
            }
            return `${min}-${max} dana`;
        }
        const value = min ?? max;
        return value == null ? '-' : `${value} ${value === 1 ? 'dan' : 'dana'}`;
    };

    return (
        <div className="grid grid-cols-2 gap-2">
            <AttributeCard
                icon={<PlantGridIcon totalPlants={totalPlants} />}
                header={`Broj biljaka na ${FIELD_SIZE_LABEL}`}
                value={totalPlants.toString()}
                description={`Podignuta gredica podjeljena je na polja veličine ${FIELD_SIZE_LABEL}. Gredica dimenzija 2x1 metar ima 18 polja za sijanje tvojih biljaka. U svako polje može stati određeni broj biljaka, ovisno o vrsti odnosno o razmaku sijanja/sadnje biljke.`}
                navigateHref={KnownPages.RaisedBeds}
                navigateLabel="Više o gredicama"
            />
            <AttributeCard
                icon={<Ruler />}
                header="Razmak sijanja/sadnje"
                value={`${
                    attributes?.seedingDistance != null
                        ? attributes.seedingDistance
                        : '-'
                } cm`}
            />
            <AttributeCard
                icon={<ArrowDownToLine />}
                header="Dubina sijanja"
                value={`${
                    attributes?.seedingDepth != null
                        ? attributes.seedingDepth
                        : '-'
                } cm`}
            />
            <AttributeCard
                icon={<Sprout />}
                header="Klijanje"
                value={attributes?.germinationType ?? '-'}
            />
            <AttributeCard
                icon={<Thermometer />}
                header="Temperatura klijanja"
                value={`${attributes?.gernimationTemperature ?? '-'}°C`}
            />
            <AttributeCard
                icon={<Timer />}
                header="Vrijeme klijanja"
                value={formatDayRange(
                    attributes?.germinationWindowMin,
                    attributes?.germinationWindowMax,
                )}
            />
        </div>
    );
}
