import { FarmerPaperNote } from '@apps/app/components/operations/FarmerPaperNote';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'apps/app/Operations/FarmerPaperNote',
    component: FarmerPaperNote,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'FarmerPaperNote presents completion notes in the operations list as a compact, handwritten paper note.',
            },
        },
    },
    args: {
        children: 'Zaliveno nakon berbe. Tlo je još uvijek vlažno.',
    },
    render: (args) => (
        <div className="w-[min(28rem,calc(100vw-3rem))] py-2">
            <FarmerPaperNote {...args} />
        </div>
    ),
} satisfies Meta<typeof FarmerPaperNote>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Multiline: Story = {
    args: {
        children:
            'Uklonjen korov oko rajčice.\nOstavio sam malč jer je zemlja ispod još vlažna.',
    },
};

export const LongNote: Story = {
    args: {
        children:
            'Pregledao sam cijelu gredicu nakon jutarnje kiše. Zapadni red nije trebalo dodatno zalijevati, ali sam podupro dvije više stabljike rajčice i uklonio oštećene listove. Kod sljedećeg obilaska treba provjeriti novu vezicu uz treću biljku i ubrati zrele plodove prije najavljenog toplog vremena.',
    },
};
