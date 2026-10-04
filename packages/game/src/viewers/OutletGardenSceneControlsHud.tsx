'use client';

import { IconButton } from '@gredice/ui/IconButton';
import { Megaphone } from '@gredice/ui/icons';
import { useState } from 'react';
import { AudioHud } from '../hud/AudioHud';
import { CameraHud } from '../hud/CameraHud';
import { ControlsTooltipHud } from '../hud/ControlsTooltipHud';
import { WhatsNewWidget } from '../hud/WhatsNewWidget';

export function OutletGardenSceneControlsHud() {
    const [whatsNewOpenRequestId, setWhatsNewOpenRequestId] = useState(0);

    return (
        <>
            <div
                className="pointer-events-none absolute bottom-[var(--game-safe-area-bottom,0px)] left-[var(--game-safe-area-left,0px)] z-10 flex items-center p-2"
                data-outlet-garden-scene-controls
            >
                <CameraHud />
                <AudioHud />
                <ControlsTooltipHud mode="view" offsetForItemsHud={false} />
                <IconButton
                    className="pointer-events-auto hover:bg-muted"
                    onClick={() =>
                        setWhatsNewOpenRequestId((current) => current + 1)
                    }
                    title="Što je novo"
                    variant="plain"
                >
                    <Megaphone className="size-5" />
                </IconButton>
            </div>

            <WhatsNewWidget enabled openRequestId={whatsNewOpenRequestId} />
        </>
    );
}
