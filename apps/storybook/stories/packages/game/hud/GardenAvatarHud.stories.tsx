import { GardenAvatarHud } from '@packages/game/hud/GardenAvatarHud';
import { createGameState, GameStateContext } from '@packages/game/useGameState';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useEffect, useRef } from 'react';

function GardenAvatarHudStory() {
    const gameStateRef = useRef<ReturnType<typeof createGameState> | null>(
        null,
    );

    if (!gameStateRef.current) {
        gameStateRef.current = createGameState({
            appBaseUrl: '',
            freezeTime: new Date('2026-08-11T18:00:00.000Z'),
            isMock: true,
            mockGardenProfile: 'default',
            winterMode: 'summer',
        });
        gameStateRef.current.getState().setGardenAvatarView('third-person');
    }

    useEffect(() => {
        const touchEventTimeout = window.setTimeout(() => {
            window.dispatchEvent(
                new PointerEvent('pointerdown', { pointerType: 'touch' }),
            );
        });

        return () => window.clearTimeout(touchEventTimeout);
    }, []);

    return (
        <GameStateContext.Provider value={gameStateRef.current}>
            <div className="relative aspect-2/1 max-h-[450px] min-h-[320px] w-full overflow-hidden bg-emerald-950">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_55%_45%,rgba(52,211,153,0.25),transparent_28%),linear-gradient(145deg,rgba(21,128,61,0.7),rgba(20,83,45,0.9))]" />
                <GardenAvatarHud />
            </div>
        </GameStateContext.Provider>
    );
}

const meta = {
    title: 'packages/game/hud/GardenAvatarHud',
    component: GardenAvatarHudStory,
    parameters: {
        layout: 'fullscreen',
        docs: {
            description: {
                component:
                    'Touch controls for walking through a garden, including the movement joystick and icon-only character actions.',
            },
        },
    },
} satisfies Meta<typeof GardenAvatarHudStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TouchControls: Story = {};
