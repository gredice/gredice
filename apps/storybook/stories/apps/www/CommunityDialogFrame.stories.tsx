import { CommunityDialogFooter } from '@apps/www/components/community-edits/CommunityDialogFooter';
import { CommunityDialogFrame } from '@apps/www/components/community-edits/CommunityDialogFrame';
import { CommunityDialogSkeleton } from '@apps/www/components/community-edits/CommunityDialogSkeleton';
import { CommunitySubmissionSteps } from '@apps/www/components/community-edits/CommunitySubmissionSteps';
import { CommunitySuccessFooter } from '@apps/www/components/community-edits/CommunitySuccessFooter';
import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { Typography } from '@gredice/ui/Typography';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'apps/www/Community/CommunityDialogFrame',
    component: CommunityDialogFrame,
    parameters: {
        docs: {
            description: {
                component:
                    'Shared shell of the community dialogs: what the suggestion is about, the title, the review promise and a footer that stays in view.',
            },
        },
    },
    args: {
        open: true,
        onOpenChange: () => {},
        title: 'Predloži izmjenu',
        context: 'Rajčica · Sijanje',
        children: null,
    },
} satisfies Meta<typeof CommunityDialogFrame>;

export default meta;
type Story = StoryObj<typeof meta>;

function Footer({ summary }: { summary: string }) {
    return (
        <CommunityDialogFooter>
            <Typography className="min-w-0 flex-1 basis-48" level="body2">
                {summary}
            </Typography>
            <div className="ml-auto flex shrink-0 gap-2">
                <Button type="button" variant="plain">
                    Odustani
                </Button>
                <Button type="button">Pošalji prijedlog</Button>
            </div>
        </CommunityDialogFooter>
    );
}

export const Loading: Story = {
    args: {
        size: 'lg',
        children: (
            <>
                <CommunityDialogSkeleton />
                <Footer summary="Promijeni barem jedno polje da pošalješ prijedlog." />
            </>
        ),
    },
};

export const WithError: Story = {
    args: {
        children: (
            <>
                <Alert color="danger">
                    Podaci su promijenjeni. Pokušaj ponovno.
                </Alert>
                <Footer summary="1 izmjena: Opis faze" />
            </>
        ),
    },
};

export const LongContent: Story = {
    args: {
        size: 'lg',
        children: (
            <>
                <div className="space-y-3">
                    {Array.from({ length: 12 }, (_, index) => (
                        <div
                            className="h-24 rounded-lg border border-border/70 bg-muted/30"
                            // biome-ignore lint/suspicious/noArrayIndexKey: Static placeholder rows.
                            key={index}
                        />
                    ))}
                </div>
                <Footer summary="2 izmjene: Opis faze, Dubina sijanja" />
            </>
        ),
    },
};

export const Sent: Story = {
    args: {
        title: 'Prijedlog je poslan',
        description: 'Prijedlog #42 · 2 izmjene',
        children: (
            <>
                <CommunitySubmissionSteps />
                <CommunityDialogFooter>
                    <CommunitySuccessFooter onClose={() => {}} />
                </CommunityDialogFooter>
            </>
        ),
    },
};
