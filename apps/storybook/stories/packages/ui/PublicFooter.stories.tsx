import { Footer1 } from '@gredice/ui/cms';
import { Logotype, PublicFooterOrigin } from '@gredice/ui/PublicChrome';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'packages/ui/Public Chrome/Public Footer',
    component: Footer1,
    tags: ['autodocs'],
    parameters: {
        layout: 'fullscreen',
        docs: {
            description: {
                component:
                    'Public footer with a prominent Croatian and EU origin sign-off above the garden artwork. Flags are 40 × 30 px with 18 px text on narrow footers, stacking above the message; wide footers use 48 × 36 px flags beside 20 px text. The copyright stays separate.',
            },
        },
    },
    args: {
        tagline: 'Gredice d.o.o',
        asset: <Logotype className="w-[320px] h-[87px]" />,
        description: <PublicFooterOrigin />,
        features: [
            {
                header: 'Informacije',
                ctas: [
                    { label: 'O nama', href: '/o-nama' },
                    { label: 'Kontaktiraj nas', href: '/kontakt' },
                ],
            },
        ],
    },
} satisfies Meta<typeof Footer1>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Mobile: Story = {
    decorators: [
        (Story) => (
            <div className="max-w-[375px]">
                <Story />
            </div>
        ),
    ],
};
