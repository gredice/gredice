import {
    SunflowerPackageVisual,
    SunflowerText,
} from '@gredice/ui/SunflowerVisuals';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { SunflowerMascotExpressions } from '../game/hud/SunflowerMascotExpressions';

const meta = {
    title: 'packages/ui/Icons/SunflowerVisuals',
    component: SunflowerPackageVisual,
    tags: ['autodocs'],
    args: { packageCode: 'vrtna_kosarica', className: 'size-40' },
    argTypes: {
        packageCode: {
            control: 'select',
            options: [
                'mali_zalogaj',
                'vrtna_kosarica',
                'mirna_sezona',
                'puna_gredica',
                'majstor_vrtlar',
                'unknown',
            ],
        },
    },
    parameters: { layout: 'centered' },
} satisfies Meta<typeof SunflowerPackageVisual>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Package: Story = {};
export const UnknownPackage: Story = { args: { packageCode: 'unknown' } };
export const Mascot: Story = {
    render: () => <SunflowerMascotExpressions />,
};

export const MascotDark: Story = {
    render: () => (
        <div className="dark bg-background p-6 text-foreground">
            <SunflowerMascotExpressions />
        </div>
    ),
};

export const CurrencyLabels: Story = {
    render: () => (
        <div className="space-y-4">
            <p>
                <SunflowerText>Stanje: 42.000 🌻</SunflowerText>
            </p>
            <p className="text-xs">
                <SunflowerText>Bonus: +2.000 🌻</SunflowerText>
            </p>
            <p>
                <SunflowerText>Za platiti 0 🌻</SunflowerText>
            </p>
        </div>
    ),
};
