import { Button } from '@gredice/ui/Button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@gredice/ui/Tooltip';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'packages/ui/Overlays/Tooltip',
    component: Tooltip,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'Tooltip provides a Radix-backed hint surface for compact controls and data labels.',
            },
        },
    },
    render: (args) => (
        <Tooltip {...args}>
            <TooltipTrigger asChild>
                <Button variant="outlined">Prikazi savjet</Button>
            </TooltipTrigger>
            <TooltipContent>
                Ovdje ide kratak kontekst za polje ili radnju.
            </TooltipContent>
        </Tooltip>
    ),
} satisfies Meta<typeof Tooltip>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Fast: Story = {
    args: {
        delayDuration: 100,
    },
};

export const Side: Story = {
    render: (args) => (
        <Tooltip {...args}>
            <TooltipTrigger asChild>
                <Button variant="soft">Desno</Button>
            </TooltipTrigger>
            <TooltipContent side="right">
                Koristi se kad je kontrola u uskoj listi.
            </TooltipContent>
        </Tooltip>
    ),
};
