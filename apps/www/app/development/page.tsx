import { NavigatingButton } from '@signalco/ui/NavigatingButton';
import { Card, CardContent } from '@signalco/ui-primitives/Card';
import { Container } from '@signalco/ui-primitives/Container';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';

type DevelopmentResource = {
    title: string;
    description: string;
    href: string;
    icon: string;
};

type DevelopmentSection = {
    title: string;
    description: string;
    resources: DevelopmentResource[];
};

const developmentSections: DevelopmentSection[] = [
    {
        title: 'Debug & Profiling',
        description:
            'Quick access to garden tools used for diagnosing performance and behavior.',
        resources: [
            {
                title: 'Garden Debug',
                description:
                    'Main debug surface for inspecting client behavior and runtime diagnostics.',
                href: 'https://vrt.gredice.test/debug',
                icon: '🐞',
            },
            {
                title: 'Garden Profiling',
                description:
                    'Profiling page for spotting render bottlenecks and performance regressions.',
                href: 'https://vrt.gredice.test/profiling',
                icon: '📈',
            },
        ],
    },
    {
        title: 'Product Surfaces',
        description:
            'Open the main product environments used during development and QA.',
        resources: [
            {
                title: 'WWW',
                description:
                    'Marketing website used for landing, SEO, and public pages.',
                href: 'https://www.gredice.test',
                icon: '🌐',
            },
            {
                title: 'Garden',
                description:
                    'Core app for end-user garden management flows and actions.',
                href: 'https://vrt.gredice.test',
                icon: '🌱',
            },
            {
                title: 'Farm',
                description:
                    'Operations panel used by partners and farm-side workflows.',
                href: 'https://farma.gredice.test',
                icon: '🚜',
            },
            {
                title: 'App',
                description:
                    'Internal app surface for authenticated and shared product features.',
                href: 'https://app.gredice.test',
                icon: '🧩',
            },
        ],
    },
    {
        title: 'Platform & API',
        description:
            'Backend and platform endpoints for troubleshooting integrations and incidents.',
        resources: [
            {
                title: 'API',
                description:
                    'Primary API entrypoint for requests, integrations, and health checks.',
                href: 'https://api.gredice.test',
                icon: '🔌',
            },
            {
                title: 'Status',
                description:
                    'Operational status page for incidents, uptime, and maintenance notices.',
                href: 'https://status.gredice.test',
                icon: '🟢',
            },
        ],
    },
    {
        title: 'Design, Analytics & Collaboration',
        description:
            'Shared tools for component development, product analytics, and team collaboration.',
        resources: [
            {
                title: 'Storybook',
                description:
                    'Component explorer for UI development and visual documentation.',
                href: 'https://storybook.gredice.test',
                icon: '📚',
            },
            {
                title: 'PostHog',
                description:
                    'Product analytics and feature flag insights across the platform.',
                href: 'https://eu.posthog.com',
                icon: '📊',
            },
            {
                title: 'GitHub',
                description:
                    'Source control, pull requests, issue tracking, and CI visibility.',
                href: 'https://github.com/gredice',
                icon: '🐙',
            },
        ],
    },
];

export default function DevelopmentPage() {
    return (
        <Container className="py-10">
            <Stack spacing={3} className="mb-8">
                <Typography level="h2" component="h1">
                    Development Hub
                </Typography>
                <Typography level="body1" secondary>
                    All debug, development, and platform resources in one place.
                </Typography>
            </Stack>

            <Stack spacing={8}>
                {developmentSections.map((section) => (
                    <section key={section.title}>
                        <Stack spacing={2} className="mb-4">
                            <Typography level="h4" component="h2">
                                {section.title}
                            </Typography>
                            <Typography level="body2" secondary>
                                {section.description}
                            </Typography>
                        </Stack>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {section.resources.map((resource) => (
                                <Card
                                    key={resource.title}
                                    className="border-tertiary border-b-4 h-full"
                                >
                                    <CardContent noHeader>
                                        <Stack
                                            spacing={2}
                                            className="h-full justify-between"
                                        >
                                            <Stack spacing={2}>
                                                <span
                                                    className="text-3xl"
                                                    role="img"
                                                    aria-label={`${resource.title} icon`}
                                                >
                                                    {resource.icon}
                                                </span>
                                                <Typography
                                                    level="h5"
                                                    component="h3"
                                                >
                                                    {resource.title}
                                                </Typography>
                                                <Typography
                                                    level="body2"
                                                    secondary
                                                >
                                                    {resource.description}
                                                </Typography>
                                            </Stack>
                                            <NavigatingButton
                                                href={resource.href}
                                                className="w-fit"
                                            >
                                                Open resource
                                            </NavigatingButton>
                                        </Stack>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </section>
                ))}
            </Stack>
        </Container>
    );
}
