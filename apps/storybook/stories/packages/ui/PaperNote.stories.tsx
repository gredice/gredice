import { Markdown } from '@gredice/ui/Markdown';
import { PaperNote } from '@gredice/ui/PaperNote';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const longNote =
    'Pregledao sam cijelu gredicu nakon jutarnje kiše. Zapadni red nije trebalo dodatno zalijevati, ali sam podupro dvije više stabljike rajčice i uklonio oštećene listove.\nKod sljedećeg obilaska treba provjeriti novu vezicu uz treću biljku i ubrati zrele plodove prije najavljenog toplog vremena.';

const meta = {
    title: 'packages/ui/Content/PaperNote',
    component: PaperNote,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'Saved notes in Garden, Farm and Admin share ruled paper with tape placement derived from the record key. Detail views show the full note; preview clamps admin list notes to four lines.',
            },
        },
    },
    args: {
        noteKey: 42,
        children: 'Zaliveno nakon berbe. Tlo je još uvijek vlažno.',
    },
    render: (args) => (
        <div className="w-[min(28rem,calc(100vw-6rem))] p-2">
            <PaperNote {...args} />
        </div>
    ),
} satisfies Meta<typeof PaperNote>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Multiline: Story = {
    args: {
        children:
            'Uklonjen korov oko rajčice.\nOstavio sam malč jer je zemlja ispod još vlažna.',
    },
};
export const LongNote: Story = { args: { children: longNote } };
export const ListPreview: Story = {
    args: { children: longNote, preview: true },
};
export const UnbrokenText: Story = {
    args: { children: `Oznaka fotografije: ${'gredica'.repeat(45)}` },
};
export const TapeVariations: Story = {
    render: (args) => (
        <div className="grid w-[min(48rem,calc(100vw-6rem))] max-w-3xl gap-5 p-4 sm:grid-cols-2">
            {[42, 43, 44, 45, 46, 47].map((id) => (
                <PaperNote {...args} key={id} noteKey={id} />
            ))}
        </div>
    ),
};
export const FormattedNote: Story = {
    render: (args) => (
        <div className="w-[min(28rem,calc(100vw-6rem))] p-2">
            <PaperNote {...args}>
                <Markdown className="whitespace-normal text-inherit prose-headings:text-inherit prose-a:text-inherit prose-strong:text-inherit! [&_li::marker]:text-[#927a4e]">
                    {
                        '**Pregled gredice**\n\n- Tlo je vlažno.\n- Provjeriti vezice.\n\n[Upute za uzgoj](https://www.gredice.com)'
                    }
                </Markdown>
            </PaperNote>
        </div>
    ),
};
