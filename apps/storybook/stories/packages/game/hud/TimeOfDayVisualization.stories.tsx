import {
    TimeOfDayVisualization,
    type TimeOfDayVisualizationProps,
} from '@packages/game/hud/components/TimeOfDayVisualization';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';

function formatTimeOfDay(timeOfDay: number) {
    const totalMinutes = Math.round(timeOfDay * 24 * 60);
    if (totalMinutes >= 24 * 60) {
        return '24:00';
    }

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes
        .toString()
        .padStart(2, '0')}`;
}

function InteractiveTimeOfDayVisualization() {
    const [timeOfDay, setTimeOfDay] = useState(0.38);

    return (
        <div className="grid gap-3">
            <TimeOfDayVisualization
                interactive
                onChange={setTimeOfDay}
                timeOfDay={timeOfDay}
            />
            <div className="text-center text-sm tabular-nums text-muted-foreground">
                {formatTimeOfDay(timeOfDay)}
            </div>
        </div>
    );
}

const dayStates = [
    { label: 'Zora', timeOfDay: 0.18 },
    { label: 'Jutro', timeOfDay: 0.32 },
    { label: 'Podne', timeOfDay: 0.5 },
    { label: 'Večer', timeOfDay: 0.78 },
    { label: 'Noć', timeOfDay: 0.9 },
] satisfies Array<{ label: string; timeOfDay: number }>;

const meta = {
    title: 'packages/game/hud/TimeOfDayVisualization',
    component: TimeOfDayVisualization,
    tags: ['autodocs'],
    args: {
        interactive: false,
        timeOfDay: 0.5,
    },
    argTypes: {
        onChange: { table: { disable: true } },
    },
    parameters: {
        docs: {
            description: {
                component:
                    'Shared HUD visualization for the garden day/night cycle. It is read-only in normal gameplay and interactive only for sandbox/debug controls.',
            },
        },
    },
    decorators: [
        (Story) => (
            <div className="w-[min(calc(100vw-2rem),22rem)]">
                <Story />
            </div>
        ),
    ],
} satisfies Meta<typeof TimeOfDayVisualization>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Current: Story = {
    name: 'Current',
};

export const Night: Story = {
    name: 'Night',
    args: {
        timeOfDay: 0.9,
    },
};

export const Compact: Story = {
    name: 'Compact',
    args: {
        compact: true,
        timeOfDay: 0.35,
    },
};

export const DebugInteractive: Story = {
    name: 'Debug interactive',
    render: () => <InteractiveTimeOfDayVisualization />,
};

export const CycleStates: Story = {
    name: 'Cycle states',
    render: (args: TimeOfDayVisualizationProps) => (
        <div className="grid gap-4">
            {dayStates.map((state) => (
                <div className="grid gap-1" key={state.label}>
                    <div className="flex items-center justify-between text-sm">
                        <span>{state.label}</span>
                        <span className="tabular-nums text-muted-foreground">
                            {formatTimeOfDay(state.timeOfDay)}
                        </span>
                    </div>
                    <TimeOfDayVisualization
                        {...args}
                        interactive={false}
                        timeOfDay={state.timeOfDay}
                    />
                </div>
            ))}
        </div>
    ),
};
