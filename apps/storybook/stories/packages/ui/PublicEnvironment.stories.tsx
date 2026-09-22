import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { PublicEnvironmentPreview } from './PublicEnvironmentPreview';

const meta = {
    title: 'packages/ui/Public Chrome/Public Environment',
    component: PublicEnvironmentPreview,
    tags: ['autodocs'],
    parameters: {
        layout: 'fullscreen',
        docs: {
            description: {
                component:
                    'Time-of-day sky and matching footer garden used on the public www and News surfaces. The preview includes astronomical sun/moon placement, moon phase, weather tone, and the contrast veil behind unframed public content, secondary labels, and growing instructions.',
            },
        },
    },
    argTypes: {
        hour: {
            control: { min: 0, max: 23, step: 0.25, type: 'range' },
        },
        weatherKind: {
            control: 'select',
            options: ['clear', 'cloudy', 'rain', 'snow', 'fog', 'storm'],
        },
    },
    args: {
        hour: 20,
        weatherKind: 'clear',
    },
} satisfies Meta<typeof PublicEnvironmentPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Dusk: Story = {};

export const Sunrise: Story = {
    args: { hour: 6.5, weatherKind: 'clear' },
};

export const Day: Story = {
    args: { hour: 13, weatherKind: 'clear' },
};

export const RainyDay: Story = {
    args: { hour: 13, weatherKind: 'rain' },
};

export const SnowyMorning: Story = {
    args: { hour: 8, weatherKind: 'snow' },
};

export const ClearNight: Story = {
    args: { hour: 23, weatherKind: 'clear' },
};
