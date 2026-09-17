import { SunflowerPackageVisual } from '@gredice/ui/SunflowerVisuals';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { SunflowerMascotComparison } from '../game/hud/SunflowerMascotComparison';

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
export const MascotProposal: Story = {
    render: () => <SunflowerMascotComparison />,
};
