import { StyledHtml } from '@gredice/ui/StyledHtml';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'packages/ui/Typography/StyledHtml',
    component: StyledHtml,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'StyledHtml applies Gredice prose styling to trusted HTML content such as plant guides, articles, and CMS-rendered sections.',
            },
        },
    },
    args: {
        children: (
            <div>
                <h2>Uzgoj rajčice</h2>
                <p>
                    Rajčica (<em>Solanum lycopersicum</em>) je jedna od
                    najpopularnijih povrtnih kultura u vrtovima. Zahtijeva
                    sunčano mjesto i redovito zalijevanje.
                </p>
                <h3>Sjetva i presađivanje</h3>
                <ul>
                    <li>Sjetva u toplom: veljača – ožujak</li>
                    <li>Presađivanje na otvoreno: svibanj</li>
                    <li>Razmak sadnje: 50 × 60 cm</li>
                </ul>
                <hr />
                <p>
                    Za više savjeta posjetite{' '}
                    <a href="https://www.gredice.com">Gredice</a>.
                </p>
            </div>
        ),
    },
} satisfies Meta<typeof StyledHtml>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
