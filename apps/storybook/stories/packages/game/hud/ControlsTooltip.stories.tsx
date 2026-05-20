import {
    ControlsVisualization,
    DesktopMoveControls,
    PinchGesture,
    RotateControls,
    ScrollWheelIndicator,
    TouchIndicator,
    VisualizationSection,
    WireframeCube,
} from '@packages/game/hud/controls-tooltip';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useEffect, useState } from 'react';

const TWO_PI = Math.PI * 2;

function AnimatedVisualization({
    deviceType,
}: {
    deviceType: 'desktop' | 'tablet' | 'mobile';
}) {
    const [phase, setPhase] = useState(0.75);
    useEffect(() => {
        const id = setInterval(() => setPhase((p) => (p + 0.12) % TWO_PI), 50);
        return () => clearInterval(id);
    }, []);
    return <ControlsVisualization deviceType={deviceType} phase={phase} />;
}

const meta = {
    title: 'packages/game/hud/ControlsTooltip',
    component: ControlsVisualization,
    tags: ['autodocs'],
    args: {
        deviceType: 'desktop',
        phase: 0.75,
    },
    parameters: {
        docs: {
            description: {
                component:
                    'Animated visual guide that shows players how to pan, zoom, and rotate the garden — adapts between desktop (mouse/keyboard) and touch layouts.',
            },
        },
    },
    decorators: [
        (Story) => (
            <div className="inline-block rounded-md bg-background p-2">
                <Story />
            </div>
        ),
    ],
} satisfies Meta<typeof ControlsVisualization>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop: Story = {
    name: 'Showcase — Desktop',
    render: () => <AnimatedVisualization deviceType="desktop" />,
};

export const Mobile: Story = {
    name: 'Showcase — Mobile',
    render: () => <AnimatedVisualization deviceType="mobile" />,
};

export const MoveDesktop: Story = {
    name: 'Move — Desktop',
    render: () => (
        <VisualizationSection
            title="Pomak"
            label="Strelice"
            cube={<WireframeCube translateX={8} />}
            controls={<DesktopMoveControls activeKey="ArrowRight" />}
        />
    ),
};

export const MoveMobile: Story = {
    name: 'Move — Mobile',
    render: () => (
        <VisualizationSection
            title="Pomak"
            label="Povuci"
            cube={<WireframeCube translateX={8} />}
            controls={<TouchIndicator touchX={6} touchY={2} />}
        />
    ),
};

export const ZoomDesktop: Story = {
    name: 'Zoom — Desktop',
    render: () => (
        <VisualizationSection
            title="Zum"
            label="Kotačić"
            cube={<WireframeCube scale={1.1} />}
            controls={<ScrollWheelIndicator isZoomingIn progress={0.75} />}
        />
    ),
};

export const ZoomMobile: Story = {
    name: 'Zoom — Mobile',
    render: () => (
        <VisualizationSection
            title="Zum"
            label="Stisni"
            cube={<WireframeCube scale={0.9} />}
            controls={<PinchGesture spread={0.25} />}
        />
    ),
};

export const RotateDesktop: Story = {
    name: 'Rotate — Desktop',
    render: () => (
        <VisualizationSection
            title="Rotacija"
            label="Q / W"
            cube={<WireframeCube rotateY={40} />}
            controls={<RotateControls activeDirection="cw" showKeyHints />}
        />
    ),
};

export const RotateMobile: Story = {
    name: 'Rotate — Mobile',
    render: () => (
        <VisualizationSection
            title="Rotacija"
            label="Tipke"
            cube={<WireframeCube rotateY={-40} />}
            controls={
                <RotateControls activeDirection="ccw" showKeyHints={false} />
            }
        />
    ),
};
