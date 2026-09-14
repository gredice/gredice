import {
    GameHealthIcon,
    GameHeartIcon,
    GameLightningIcon,
    GamePlantStatusIcon,
    GameThermometerIcon,
    GameToolsIcon,
    GameWaterIcon,
} from '@gredice/ui/GameIcons';
import { IconButton } from '@gredice/ui/IconButton';
import { RecommendationSection } from '@packages/game/hud/raisedBed/RecommendationSection';
import { ButtonGreen } from '@packages/game/shared-ui/ButtonGreen';
import { useState } from 'react';

export function PlantCareHudPreview() {
    const [showNeighbours, setShowNeighbours] = useState(false);
    const [healthOpen, setHealthOpen] = useState(false);
    const [operationsOpen, setOperationsOpen] = useState(false);
    return (
        <section aria-label="Plant care HUD" className="space-y-4">
            <h2 className="text-lg font-semibold">Plant care in context</h2>
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted p-4 text-foreground">
                <ButtonGreen
                    size="sm"
                    className="rounded-full px-2 text-lime-950"
                >
                    <GameWaterIcon className="size-5 shrink-0" aria-hidden />
                    <span className="sr-only">Vlažnost tla: </span>48%
                </ButtonGreen>
                <ButtonGreen
                    size="sm"
                    className="rounded-full px-2 text-lime-950"
                >
                    <GameThermometerIcon
                        className="size-5 shrink-0"
                        aria-hidden
                    />
                    <span className="sr-only">Temperatura tla: </span>22°C
                </ButtonGreen>
                <IconButton
                    aria-label="Dobri i loši susjedi"
                    aria-pressed={showNeighbours}
                    variant="outlined"
                    onClick={() => setShowNeighbours(!showNeighbours)}
                >
                    <span className="flex items-center -space-x-1">
                        <GameHeartIcon
                            className="size-5 shrink-0"
                            aria-hidden
                        />
                        <GameLightningIcon
                            className="size-5 shrink-0"
                            aria-hidden
                        />
                    </span>
                </IconButton>
                {showNeighbours && (
                    <div className="flex gap-3 text-xs">
                        <span className="flex items-center gap-1">
                            <GameHeartIcon className="size-5" aria-hidden />
                            Dobri susjedi
                        </span>
                        <span className="flex items-center gap-1">
                            <GameLightningIcon className="size-5" aria-hidden />
                            Loši susjedi
                        </span>
                    </div>
                )}
            </div>
            <div className="flex flex-wrap items-center gap-4 rounded-lg border bg-card p-4">
                <div className="flex size-[100px] shrink-0 flex-col items-center justify-center gap-1 rounded-full border bg-background shadow">
                    <GamePlantStatusIcon
                        status="firstFruitSet"
                        className="size-7"
                        aria-hidden
                    />
                    <span className="text-center text-base font-semibold">
                        Prvi plodovi
                    </span>
                </div>
                <div className="min-w-0 flex-1 basis-64 divide-y rounded-md border px-2">
                    <RecommendationSection
                        kind="operations"
                        title="Radnje"
                        count={3}
                        icon={<GameToolsIcon className="size-5" aria-hidden />}
                        open={operationsOpen}
                        onOpenChange={setOperationsOpen}
                    >
                        <p className="text-sm">Zalijevanje i njega biljke.</p>
                    </RecommendationSection>
                    <RecommendationSection
                        kind="health"
                        title="Zdravlje biljke"
                        count={5}
                        icon={<GameHealthIcon className="size-5" aria-hidden />}
                        open={healthOpen}
                        onOpenChange={setHealthOpen}
                    >
                        <p className="text-sm">Preporuke za zdravlje biljke.</p>
                    </RecommendationSection>
                </div>
            </div>
        </section>
    );
}
