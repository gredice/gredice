import { FarmScheduleSectionSkeleton } from '@apps/farm/app/schedule/FarmScheduleSectionSkeleton';
import { HomeButton } from '@apps/farm/components/HomeButton';
import { Row } from '@gredice/ui/Row';
import { ScheduleDateNavigation } from '@gredice/ui/ScheduleDateNavigation';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'apps/farm/Schedule/Shell',
    component: ScheduleDateNavigation,
    tags: ['autodocs'],
    args: {
        date: new Date('2026-05-21T00:00:00'),
        basePath: '/schedule',
    },
    parameters: {
        docs: {
            description: {
                component:
                    'Farm schedule shell with date navigation and loading states used before authenticated schedule data resolves.',
            },
        },
    },
    render: () => (
        <div className="min-h-96 bg-muted p-4">
            <Stack className="mx-auto w-full max-w-5xl" spacing={8}>
                <Row spacing={4} justifyContent="space-between">
                    <Row spacing={2}>
                        <HomeButton />
                        <Typography level="h4" component="h1">
                            Raspored
                        </Typography>
                    </Row>
                    <ScheduleDateNavigation
                        date={new Date('2026-05-21T00:00:00')}
                        basePath="/schedule"
                    />
                </Row>
                <FarmScheduleSectionSkeleton />
            </Stack>
        </div>
    ),
} satisfies Meta<typeof ScheduleDateNavigation>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
