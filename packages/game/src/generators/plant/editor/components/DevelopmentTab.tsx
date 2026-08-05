'use client';

import { Checkbox } from '@gredice/ui/Checkbox';
import { Divider } from '@gredice/ui/Divider';
import { SelectItems } from '@gredice/ui/SelectItems';
import { Typography } from '@gredice/ui/Typography';
import {
    MAX_PLANT_GENERATION,
    type PlantDevelopmentStorage,
} from '../../lib/plant-definitions';
import type { PlantControlsProps } from '../@types/plant-generator';
import { InfoHint } from './InfoHint';
import { PlantSlider } from './PlantSlider';

const architectureOptions = [
    { value: 'rosette', label: 'Rozeta' },
    { value: 'clump', label: 'Busen' },
    { value: 'upright', label: 'Uspravna' },
    { value: 'vine', label: 'Puzavica' },
    { value: 'shrub', label: 'Grm' },
    { value: 'tree', label: 'Stablo' },
];

const habitOptions = [
    { value: 'basal', label: 'Bazalni rast' },
    { value: 'upright', label: 'Uspravno' },
    { value: 'prostrate', label: 'Polegnuto' },
    { value: 'climbing', label: 'Penjačica' },
    { value: 'woody', label: 'Drvenasto' },
];

const branchingOptions = [
    { value: 'none', label: 'Bez grananja' },
    { value: 'alternate', label: 'Naizmjenično' },
    { value: 'opposite', label: 'Nasuprotno' },
    { value: 'forked', label: 'Račvasto' },
    { value: 'multi-stem', label: 'Više stabljika' },
    { value: 'sympodial', label: 'Simpodijalno' },
];

const foliageArrangementOptions = [
    { value: 'rosette', label: 'Rozeta' },
    { value: 'fan', label: 'Lepeza' },
    { value: 'alternate', label: 'Naizmjenično' },
    { value: 'opposite', label: 'Nasuprotno' },
    { value: 'whorled', label: 'Pršljenasto' },
];

const reproductiveSiteOptions = [
    { value: 'terminal', label: 'Na vrhu' },
    { value: 'axillary', label: 'U pazušcu lista' },
    { value: 'truss', label: 'Grozd' },
    { value: 'spike', label: 'Klas' },
    { value: 'umbel', label: 'Štitac' },
];

const flowerFormOptions = [
    { value: 'cluster', label: 'Skupina' },
    { value: 'pea', label: 'Leptirasti' },
    { value: 'pom-pom', label: 'Kuglasti' },
    { value: 'spike', label: 'Klasasti' },
    { value: 'star', label: 'Zvjezdasti' },
    { value: 'umbel', label: 'Štitasti' },
];

const defaultStorage: PlantDevelopmentStorage = {
    aboveSoilFraction: 0,
    birthGeneration: 1,
    matureGeneration: 9,
    sizeScale: 1,
};

function SectionTitle({ children }: { children: string }) {
    return (
        <>
            <Divider />
            <Typography level="body2" bold>
                {children}
            </Typography>
        </>
    );
}

export function DevelopmentTab({
    state,
    onDefinitionChange,
    organCount,
}: PlantControlsProps) {
    const development = state.definition.development;
    const { axes, foliage, phenology, reproduction } = development;
    const special = development.special ?? {};
    const storage = development.storage;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
                <Typography level="body2" bold>
                    Razvojni model
                </Typography>
                <InfoHint
                    label="Kako radi razvojni model"
                    title="Graf biljnih organa"
                >
                    <Typography level="body3">
                        Model stvara stabilan graf stabljika, listova, cvjetova,
                        plodova i posebnih organa. Ista vrsta i sjeme uvijek
                        daju isti raspored kroz sve faze rasta.
                    </Typography>
                </InfoHint>
            </div>
            <Typography level="body3" secondary>
                Trenutno je razvijeno {organCount} organa.
            </Typography>
            <SelectItems
                label="Arhitektura"
                value={development.architecture}
                items={architectureOptions}
                onValueChange={(value) =>
                    onDefinitionChange('development.architecture', value)
                }
            />
            <PlantSlider
                label={`Varijabilnost: ${development.variability.toFixed(2)}`}
                value={[development.variability]}
                onValueChange={(value) =>
                    onDefinitionChange('development.variability', value[0])
                }
                min={0}
                max={0.4}
                step={0.01}
            />

            <SectionTitle>Fenologija</SectionTitle>
            <PlantSlider
                label={`Početak nicanja: ${phenology.emergenceStart.toFixed(1)}`}
                value={[phenology.emergenceStart]}
                onValueChange={(value) =>
                    onDefinitionChange(
                        'development.phenology.emergenceStart',
                        value[0],
                    )
                }
                min={0}
                max={MAX_PLANT_GENERATION}
                step={0.1}
            />
            <PlantSlider
                label={`Zrelost: ${phenology.maturityGeneration.toFixed(1)}`}
                value={[phenology.maturityGeneration]}
                onValueChange={(value) =>
                    onDefinitionChange(
                        'development.phenology.maturityGeneration',
                        value[0],
                    )
                }
                min={0.5}
                max={MAX_PLANT_GENERATION}
                step={0.1}
            />
            <Checkbox
                id="senescence-enabled"
                label="Uključi početak starenja"
                checked={phenology.senescenceStart !== undefined}
                onCheckedChange={(checked: boolean) =>
                    onDefinitionChange(
                        'development.phenology.senescenceStart',
                        checked
                            ? Math.min(
                                  MAX_PLANT_GENERATION,
                                  phenology.maturityGeneration + 1,
                              )
                            : undefined,
                    )
                }
                className="h-4 w-4"
            />
            {phenology.senescenceStart !== undefined ? (
                <PlantSlider
                    label={`Početak starenja: ${phenology.senescenceStart.toFixed(1)}`}
                    value={[phenology.senescenceStart]}
                    onValueChange={(value) =>
                        onDefinitionChange(
                            'development.phenology.senescenceStart',
                            value[0],
                        )
                    }
                    min={0}
                    max={MAX_PLANT_GENERATION}
                    step={0.1}
                />
            ) : null}

            <SectionTitle>Osi i grananje</SectionTitle>
            <SelectItems
                label="Način rasta"
                value={axes.habit}
                items={habitOptions}
                onValueChange={(value) =>
                    onDefinitionChange('development.axes.habit', value)
                }
            />
            <SelectItems
                label="Uzorak grananja"
                value={axes.branchingPattern}
                items={branchingOptions}
                onValueChange={(value) =>
                    onDefinitionChange(
                        'development.axes.branchingPattern',
                        value,
                    )
                }
            />
            <PlantSlider
                label={`Broj glavnih osi: ${axes.axisCount}`}
                value={[axes.axisCount]}
                onValueChange={(value) =>
                    onDefinitionChange('development.axes.axisCount', value[0])
                }
                min={0}
                max={8}
                step={1}
            />
            <PlantSlider
                label={`Čvorovi po osi: ${axes.nodeCount}`}
                value={[axes.nodeCount]}
                onValueChange={(value) =>
                    onDefinitionChange('development.axes.nodeCount', value[0])
                }
                min={0}
                max={24}
                step={1}
            />
            <PlantSlider
                label={`Dužina internodija: ${axes.internodeLengthScale.toFixed(2)}`}
                value={[axes.internodeLengthScale]}
                onValueChange={(value) =>
                    onDefinitionChange(
                        'development.axes.internodeLengthScale',
                        value[0],
                    )
                }
                min={0}
                max={2}
                step={0.05}
            />
            <PlantSlider
                label={`Nagib osi: ${axes.pitchDegrees.toFixed(0)}°`}
                value={[axes.pitchDegrees]}
                onValueChange={(value) =>
                    onDefinitionChange(
                        'development.axes.pitchDegrees',
                        value[0],
                    )
                }
                min={-30}
                max={75}
                step={1}
            />
            <PlantSlider
                label={`Širenje: ${axes.spread.toFixed(2)}`}
                value={[axes.spread]}
                onValueChange={(value) =>
                    onDefinitionChange('development.axes.spread', value[0])
                }
                min={0}
                max={1.5}
                step={0.05}
            />
            <PlantSlider
                label={`Broj grana: ${axes.branchCount}`}
                value={[axes.branchCount]}
                onValueChange={(value) =>
                    onDefinitionChange('development.axes.branchCount', value[0])
                }
                min={0}
                max={16}
                step={1}
            />
            <PlantSlider
                label={`Čvorovi po grani: ${axes.branchNodeCount}`}
                value={[axes.branchNodeCount]}
                onValueChange={(value) =>
                    onDefinitionChange(
                        'development.axes.branchNodeCount',
                        value[0],
                    )
                }
                min={0}
                max={12}
                step={1}
            />
            <PlantSlider
                label={`Dužina grana: ${axes.branchLengthScale.toFixed(2)}`}
                value={[axes.branchLengthScale]}
                onValueChange={(value) =>
                    onDefinitionChange(
                        'development.axes.branchLengthScale',
                        value[0],
                    )
                }
                min={0}
                max={1.5}
                step={0.05}
            />
            <PlantSlider
                label={`Nagib grana: ${axes.branchPitchDegrees.toFixed(0)}°`}
                value={[axes.branchPitchDegrees]}
                onValueChange={(value) =>
                    onDefinitionChange(
                        'development.axes.branchPitchDegrees',
                        value[0],
                    )
                }
                min={0}
                max={90}
                step={1}
            />

            <SectionTitle>Raspored lišća</SectionTitle>
            <SelectItems
                label="Raspored"
                value={foliage.arrangement}
                items={foliageArrangementOptions}
                onValueChange={(value) =>
                    onDefinitionChange('development.foliage.arrangement', value)
                }
            />
            <PlantSlider
                label={`Broj listova: ${foliage.count}`}
                value={[foliage.count]}
                onValueChange={(value) =>
                    onDefinitionChange('development.foliage.count', value[0])
                }
                min={0}
                max={80}
                step={1}
            />
            <PlantSlider
                label={`Filotaksija: ${foliage.phyllotaxisDegrees.toFixed(1)}°`}
                value={[foliage.phyllotaxisDegrees]}
                onValueChange={(value) =>
                    onDefinitionChange(
                        'development.foliage.phyllotaxisDegrees',
                        value[0],
                    )
                }
                min={0}
                max={180}
                step={0.5}
            />
            <PlantSlider
                label={`Razmak nicanja: ${foliage.emergenceInterval.toFixed(2)}`}
                value={[foliage.emergenceInterval]}
                onValueChange={(value) =>
                    onDefinitionChange(
                        'development.foliage.emergenceInterval',
                        value[0],
                    )
                }
                min={0.05}
                max={2}
                step={0.05}
            />
            <PlantSlider
                label={`Trajanje sazrijevanja lista: ${foliage.maturityDuration.toFixed(1)}`}
                value={[foliage.maturityDuration]}
                onValueChange={(value) =>
                    onDefinitionChange(
                        'development.foliage.maturityDuration',
                        value[0],
                    )
                }
                min={0.1}
                max={5}
                step={0.1}
            />

            <SectionTitle>Razmnožavanje</SectionTitle>
            <SelectItems
                label="Položaj cvjetova i plodova"
                value={reproduction.site}
                items={reproductiveSiteOptions}
                onValueChange={(value) =>
                    onDefinitionChange('development.reproduction.site', value)
                }
            />
            <SelectItems
                label="Oblik cvata"
                value={reproduction.form}
                items={flowerFormOptions}
                onValueChange={(value) =>
                    onDefinitionChange('development.reproduction.form', value)
                }
            />
            <PlantSlider
                label={`Broj mjesta: ${reproduction.siteCount}`}
                value={[reproduction.siteCount]}
                onValueChange={(value) =>
                    onDefinitionChange(
                        'development.reproduction.siteCount',
                        value[0],
                    )
                }
                min={0}
                max={24}
                step={1}
            />
            <PlantSlider
                label={`Cvjetova po mjestu: ${reproduction.flowersPerSite}`}
                value={[reproduction.flowersPerSite]}
                onValueChange={(value) =>
                    onDefinitionChange(
                        'development.reproduction.flowersPerSite',
                        value[0],
                    )
                }
                min={0}
                max={12}
                step={1}
            />

            <SectionTitle>Spremišni organ</SectionTitle>
            <Checkbox
                id="storage-enabled"
                label="Uključi korijen, lukovicu ili zadebljanje"
                checked={storage !== undefined}
                onCheckedChange={(checked: boolean) =>
                    onDefinitionChange(
                        'development.storage',
                        checked ? defaultStorage : undefined,
                    )
                }
                className="h-4 w-4"
            />
            {storage ? (
                <>
                    <PlantSlider
                        label={`Početak rasta: ${storage.birthGeneration.toFixed(1)}`}
                        value={[storage.birthGeneration]}
                        onValueChange={(value) =>
                            onDefinitionChange(
                                'development.storage.birthGeneration',
                                value[0],
                            )
                        }
                        min={0}
                        max={MAX_PLANT_GENERATION}
                        step={0.1}
                    />
                    <PlantSlider
                        label={`Zrelost: ${storage.matureGeneration.toFixed(1)}`}
                        value={[storage.matureGeneration]}
                        onValueChange={(value) =>
                            onDefinitionChange(
                                'development.storage.matureGeneration',
                                value[0],
                            )
                        }
                        min={0}
                        max={MAX_PLANT_GENERATION}
                        step={0.1}
                    />
                    <PlantSlider
                        label={`Veličina: ${storage.sizeScale.toFixed(2)}`}
                        value={[storage.sizeScale]}
                        onValueChange={(value) =>
                            onDefinitionChange(
                                'development.storage.sizeScale',
                                value[0],
                            )
                        }
                        min={0.1}
                        max={2}
                        step={0.05}
                    />
                    <PlantSlider
                        label={`Iznad tla: ${(storage.aboveSoilFraction * 100).toFixed(0)}%`}
                        value={[storage.aboveSoilFraction]}
                        onValueChange={(value) =>
                            onDefinitionChange(
                                'development.storage.aboveSoilFraction',
                                value[0],
                            )
                        }
                        min={0}
                        max={1}
                        step={0.05}
                    />
                </>
            ) : null}

            <SectionTitle>Posebni organi</SectionTitle>
            <PlantSlider
                label={`Vriježe: ${special.runnerCount ?? 0}`}
                value={[special.runnerCount ?? 0]}
                onValueChange={(value) =>
                    onDefinitionChange('development.special', {
                        ...special,
                        runnerCount: value[0],
                    })
                }
                min={0}
                max={16}
                step={1}
            />
            <PlantSlider
                label={`Vitice: ${special.tendrilCount ?? 0}`}
                value={[special.tendrilCount ?? 0]}
                onValueChange={(value) =>
                    onDefinitionChange('development.special', {
                        ...special,
                        tendrilCount: value[0],
                    })
                }
                min={0}
                max={30}
                step={1}
            />
            <PlantSlider
                label={`Trnje: ${special.thornCount ?? 0}`}
                value={[special.thornCount ?? 0]}
                onValueChange={(value) =>
                    onDefinitionChange('development.special', {
                        ...special,
                        thornCount: value[0],
                    })
                }
                min={0}
                max={80}
                step={1}
            />
        </div>
    );
}
