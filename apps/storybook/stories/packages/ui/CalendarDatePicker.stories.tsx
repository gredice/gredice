import { CalendarDatePicker } from '@gredice/ui/CalendarDatePicker';
import { Stack } from '@gredice/ui/Stack';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { type ComponentProps, useState } from 'react';

function ControlledCalendarDatePicker(
    args: ComponentProps<typeof CalendarDatePicker>,
) {
    const [value, setValue] = useState(args.value);

    return (
        <CalendarDatePicker {...args} onValueChange={setValue} value={value} />
    );
}

const meta = {
    title: 'packages/ui/Inputs/CalendarDatePicker',
    component: CalendarDatePicker,
    tags: ['autodocs'],
    args: {
        label: 'Datum sijanja',
        onValueChange: () => undefined,
        value: '2026-08-02',
    },
    parameters: {
        docs: {
            description: {
                component:
                    'Localized calendar picker for date-only values, with keyboard navigation and optional minimum and maximum dates.',
            },
        },
        layout: 'centered',
    },
    render: ControlledCalendarDatePicker,
} satisfies Meta<typeof CalendarDatePicker>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const AllowedRange: Story = {
    args: {
        helperText: 'Odaberi datum unutar dostupnog termina.',
        max: '2026-10-31',
        min: '2026-08-02',
    },
};

export const States: Story = {
    render: () => (
        <Stack spacing={4} className="w-72">
            <ControlledCalendarDatePicker
                aria-invalid
                helperText="Odabrani datum više nije dostupan."
                label="Datum branja"
                min="2026-08-03"
                onValueChange={() => undefined}
                value="2026-08-02"
            />
            <ControlledCalendarDatePicker
                disabled
                label="Zaključani datum"
                onValueChange={() => undefined}
                value="2026-08-02"
            />
        </Stack>
    ),
};
