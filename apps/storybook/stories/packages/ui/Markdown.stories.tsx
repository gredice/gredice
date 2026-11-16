import { Markdown } from '@gredice/ui/Markdown';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'packages/ui/Typography/Markdown',
    component: Markdown,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'Markdown renders headings, links, lists, and GitHub-flavored tables with the Gredice editorial typography. Wide tables scroll within a keyboard-focusable region. The default `sm` size suits cards, panels and dialogs; use `size="md"` for long-form main content on public pages.',
            },
        },
    },
    args: {
        children: [
            '## Harvest Notes',
            '',
            'Use Markdown when editorial content needs headings, links, and lists.',
            '',
            '- Keep copy concise.',
            '- Prefer descriptive link labels.',
            '- Render trusted content only.',
            '',
            '[Visit Gredice](https://www.gredice.com)',
        ].join('\n'),
        className: 'max-w-xl',
    },
} satisfies Meta<typeof Markdown>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const MainContent: Story = {
    args: {
        size: 'md',
        children: [
            '## Postupak',
            '',
            'Formativna rezidba provodi se u ranim fazama rasta biljke kako bi joj se dao željeni oblik i struktura.',
            '',
            '1. Ukloni slabe i prekrižene grane.',
            '2. Ostavi tri do četiri glavna izboja.',
            '3. Zalij biljku nakon rezidbe.',
            '',
            '[Više o radnjama](/radnje)',
        ].join('\n'),
    },
};

export const Table: Story = {
    args: {
        children: [
            '## Najvažnija razlika',
            '',
            '| Pitanje | Povrtna košarica | Gredice |',
            '| :--- | :---: | ---: |',
            '| Što biraš? | Gotovu košaricu ili paket | **Biljke za svoju gredicu** |',
            '| Što pratiš? | Ponudu i termin preuzimanja | Stanje, fotografije i radnje u svojoj gredici |',
            '| Kako dolaziš do uroda? | Preuzimanjem ili dostavom košarice | [Narudžbom berbe, zatim dostavom](/dostava) |',
            '',
            'Sadržaj se nastavlja ispod tablice.',
        ].join('\n'),
    },
};

export const TableInNarrowContainer: Story = {
    args: {
        ...Table.args,
        className: 'w-full max-w-80',
    },
};
