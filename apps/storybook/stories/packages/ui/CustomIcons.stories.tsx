import { BackpackIcon } from '@gredice/ui/BackpackIcon';
import { PlantingSeedIcon } from '@gredice/ui/PlantingSeedIcon';
import { RaisedBedSimpleIcon } from '@gredice/ui/RaisedBedSimpleIcon';
import { ShovelIcon } from '@gredice/ui/ShovelIcon';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const customIcons = [
    { Icon: BackpackIcon, label: 'BackpackIcon' },
    { Icon: PlantingSeedIcon, label: 'PlantingSeedIcon' },
    { Icon: RaisedBedSimpleIcon, label: 'RaisedBedSimpleIcon' },
    { Icon: ShovelIcon, label: 'ShovelIcon' },
];

function CustomIconsShowcase() {
    return (
        <div className="flex flex-wrap gap-6">
            {customIcons.map(({ Icon, label }) => (
                <div key={label} className="flex flex-col items-center gap-2">
                    <Icon className="size-8 text-primary" />
                    <span className="font-mono text-muted-foreground text-xs">
                        {label}
                    </span>
                </div>
            ))}
        </div>
    );
}

const meta = {
    title: 'packages/ui/Icons/CustomIcons',
    component: ShovelIcon,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'CustomIcons collects reusable Gredice-specific glyphs extracted from app and game surfaces into the shared UI package.',
            },
        },
    },
    render: () => <CustomIconsShowcase />,
} satisfies Meta<typeof ShovelIcon>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AllIcons: Story = {};
