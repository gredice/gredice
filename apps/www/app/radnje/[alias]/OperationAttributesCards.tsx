import type { OperationData } from '@gredice/client';
import {
    GameGardenIcon,
    GameHistoryIcon,
    GameRaisedBedSimpleIcon,
    GameSeedlingIcon,
    GameTimerIcon,
    GameToolsIcon,
} from '@gredice/ui/GameIcons';
import type { JSX } from 'react';
import { AttributeCard } from '../../../components/attributes/DetailCard';
import { operationFrequencyLabel } from '../../biljke/[alias]/PlantOperations';

export function OperationAttributesCards({
    attributes,
}: {
    attributes: OperationData['attributes'] | undefined;
}) {
    const applicationMap: Record<string, { label: string; icon: JSX.Element }> =
        {
            garden: {
                label: 'Vrt',
                icon: (
                    <GameGardenIcon aria-hidden className="size-6 shrink-0" />
                ),
            },
            raisedBedFull: {
                label: 'Cijela gredica',
                icon: (
                    <GameRaisedBedSimpleIcon
                        aria-hidden
                        className="size-6 shrink-0"
                    />
                ),
            },
            raisedBed1m: {
                label: 'Gredica 1m²',
                icon: (
                    <GameRaisedBedSimpleIcon
                        aria-hidden
                        className="size-6 shrink-0"
                    />
                ),
            },
            plant: {
                label: 'Biljka',
                icon: (
                    <GameSeedlingIcon aria-hidden className="size-6 shrink-0" />
                ),
            },
        };

    return (
        <div className="grid grid-cols-2 gap-2">
            {attributes?.application && (
                <AttributeCard
                    icon={
                        applicationMap[attributes.application]?.icon ?? (
                            <GameToolsIcon aria-hidden />
                        )
                    }
                    header="Primjena"
                    subheader="Na čemu se radnja izvodi"
                    value={
                        applicationMap[attributes?.application]?.label ?? '-'
                    }
                />
            )}
            <AttributeCard
                icon={<GameHistoryIcon aria-hidden />}
                header="Učestalost"
                subheader="Savjet o učestalosti izvođenja radnje"
                value={operationFrequencyLabel(attributes?.frequency)}
            />
            <AttributeCard
                icon={<GameTimerIcon aria-hidden />}
                header="Trajanje"
                subheader="Prosječno vrijeme izvođenja radnje u minutama"
                value={
                    attributes?.duration != null
                        ? `${attributes.duration} min`
                        : '-'
                }
            />
            <AttributeCard
                icon={<GameSeedlingIcon aria-hidden />}
                header="Stadij"
                subheader="Preporučeni stadij biljke za izvođenje radnje"
                value={attributes?.stage?.information?.label ?? '-'}
            />
        </div>
    );
}
