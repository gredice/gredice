import { Input } from '@gredice/ui/Input';
import { Search, Settings } from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'packages/ui/Foundation/Input',
    component: Input,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'Input provides label, helper text, decorators, width, and visual variants for compact data entry.',
            },
        },
    },
    args: {
        label: 'Pretraga',
        placeholder: 'Pronadi biljku',
    },
} satisfies Meta<typeof Input>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Variants: Story = {
    render: () => (
        <Stack spacing={4}>
            <Input label="Outlined" placeholder="Zadani stil" />
            <Input label="Soft" placeholder="Tiha povrsina" variant="soft" />
            <Input label="Plain" placeholder="Bez okvira" variant="plain" />
        </Stack>
    ),
};

export const Decorators: Story = {
    args: {
        endDecorator: <Search className="mr-3 size-4" />,
        helperText: 'Dekoratori se koriste za ikone, prefikse i status.',
        label: 'Radnja',
        placeholder: 'Pretrazi radnje',
        startDecorator: <Settings className="ml-3 size-4" />,
    },
};

export const States: Story = {
    render: () => (
        <Stack spacing={4}>
            <Input
                defaultValue="Jutarnji pregled"
                helperText="Spremljena vrijednost."
                label="Popunjeno"
            />
            <Input disabled label="Nedostupno" placeholder="Zakljucano polje" />
            <Input readOnly defaultValue="Samo citanje" label="Read only" />
        </Stack>
    ),
};

export const FullWidth: Story = {
    render: () => (
        <div className="w-96">
            <Input
                fullWidth
                helperText="Full width input fills the available panel width."
                label="Naziv prikaza"
                placeholder="Npr. tjedni plan"
            />
        </div>
    ),
};

export const InlinePair: Story = {
    render: () => (
        <Row className="flex-wrap" spacing={3}>
            <Input placeholder="Ime" />
            <Input placeholder="Prezime" />
        </Row>
    ),
};
