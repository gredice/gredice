import { ImpersonationBanner } from '@gredice/ui/ImpersonationBanner';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'packages/ui/ImpersonationBanner',
    component: ImpersonationBanner,
    beforeEach: () => {
        // biome-ignore lint/suspicious/noDocumentCookie: The story sets the browser-only impersonation fixture.
        document.cookie = 'gredice_impersonating=1; path=/';
        return () => {
            // biome-ignore lint/suspicious/noDocumentCookie: The story cleans up its browser-only fixture.
            document.cookie =
                'gredice_impersonating=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        };
    },
    decorators: [
        (Story) => (
            <div className="min-h-80 rounded-xl bg-muted p-6 text-muted-foreground">
                Aplikacijski sadržaj
                <Story />
            </div>
        ),
    ],
    parameters: {
        docs: {
            description: {
                component:
                    'A draggable global impersonation notice. Its drag bounds respect device safe-area insets when an app renders edge to edge.',
            },
        },
        layout: 'fullscreen',
    },
    tags: ['autodocs'],
} satisfies Meta<typeof ImpersonationBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Active: Story = {};
