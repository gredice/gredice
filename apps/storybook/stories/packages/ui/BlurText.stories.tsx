import { BlurText } from '@gredice/ui/BlurText';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'packages/ui/Animation/BlurText',
    component: BlurText,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'BlurText reveals text with a staggered blur animation, either by words or by individual letters.',
            },
        },
    },
    args: {
        text: 'Uzgajajte zdravo povrće',
        className: 'text-3xl font-semibold text-primary',
        animateBy: 'words',
        direction: 'top',
        delay: 150,
        stepDuration: 0.35,
    },
} satisfies Meta<typeof BlurText>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ByWords: Story = {};

export const ByLetters: Story = {
    args: {
        text: 'Gredice',
        animateBy: 'letters',
        delay: 80,
        className: 'text-5xl font-bold text-primary',
    },
};

export const FromBottom: Story = {
    args: {
        text: 'Planirajte vrt za sljedeću sezonu',
        direction: 'bottom',
    },
};
