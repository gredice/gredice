import {
    Grid16Icon,
    Grid1Icon,
    Grid4Icon,
    Grid9Icon,
    PlantGridIcon,
} from '@gredice/ui/GridIcons';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

function GridIconsShowcase() {
    const icons = [
        { Icon: Grid1Icon, label: 'Grid1Icon' },
        { Icon: Grid4Icon, label: 'Grid4Icon' },
        { Icon: Grid9Icon, label: 'Grid9Icon' },
        { Icon: Grid16Icon, label: 'Grid16Icon' },
        { Icon: PlantGridIcon, label: 'PlantGridIcon' },
    ];

    return (
        <div className="flex flex-wrap gap-6">
            {icons.map(({ Icon, label }) => (
                <div key={label} className="flex flex-col items-center gap-2">
                    <Icon className="size-8 text-primary" />
                    <span className="text-xs text-muted-foreground font-mono">
                        {label}
                    </span>
                </div>
            ))}
        </div>
    );
}

const meta = {
    title: 'packages/ui/Icons/GridIcons',
    component: Grid16Icon,
    tags: ['autodocs'],
    render: () => <GridIconsShowcase />,
} satisfies Meta<typeof Grid16Icon>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AllIcons: Story = {};

export const LargeSize: Story = {
    render: () => (
        <div className="flex flex-wrap gap-6">
            {[Grid1Icon, Grid4Icon, Grid9Icon, Grid16Icon, PlantGridIcon].map(
                (Icon, i) => (
                    <Icon
                        key={i}
                        className="size-16 text-primary"
                    />
                ),
            )}
        </div>
    ),
};
