'use client';

import { IconButton } from '@gredice/ui/IconButton';
import { Megaphone } from '@gredice/ui/icons';
import { useState } from 'react';
import { AudioHud } from '../hud/AudioHud';
import { CameraHud } from '../hud/CameraHud';
import { ControlsTooltipHud } from '../hud/ControlsTooltipHud';
import { HudCard } from '../hud/components/HudCard';
import { WhatsNewWidget } from '../hud/WhatsNewWidget';

export function OutletGardenSceneControlsHud() {
    const [whatsNewOpenRequestId, setWhatsNewOpenRequestId] = useState(0);

    return (
        <>
            <div className="pointer-events-none absolute bottom-[var(--game-safe-area-bottom,0px)] left-[var(--game-safe-area-left,0px)] z-10 p-2">
                <HudCard
                    className="static p-0.5"
                    data-outlet-garden-hud-card="scene-controls"
                    open
                    position="floating"
                >
                    <div className="relative flex items-center">
                        <CameraHud />
                        <AudioHud />
                        <ControlsTooltipHud
                            mode="view"
                            offsetForItemsHud={false}
                            panelPosition="above"
                        />
                        <IconButton
                            className="pointer-events-auto hover:bg-muted"
                            onClick={() =>
                                setWhatsNewOpenRequestId(
                                    (current) => current + 1,
                                )
                            }
                            title="Što je novo"
                            variant="plain"
                        >
                            <Megaphone className="size-5" />
                        </IconButton>
                    </div>
                </HudCard>
            </div>

            <WhatsNewWidget enabled openRequestId={whatsNewOpenRequestId} />
        </>
    );
}
