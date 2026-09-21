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
                    'Public footer with Croatian and EU SVG flags identifying the company’s origin beside the copyright notice.',
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
