import {
    ChatBubble,
    ChatMarker,
    ChatMessage,
    ChatMessageScroller,
    type ChatMessageScrollerProps,
} from '@gredice/ui/Chat';
import { IconButton } from '@gredice/ui/IconButton';
import { Check, LoaderSpinner, Send, Sun } from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const assistantAvatar = (
    <span className="grid size-full place-items-center bg-amber-50 dark:bg-amber-950">
        <Sun className="size-4 text-amber-500" />
    </span>
);

const conversationItems: ChatMessageScrollerProps['items'] = [
    {
        id: 'today',
        content: <ChatMarker variant="separator">Danas</ChatMarker>,
    },
    {
        id: 'question',
        scrollAnchor: true,
        content: (
            <ChatMessage align="end">
                <ChatBubble align="end" variant="sunflower">
                    Koje radnje su najvažnije ovaj tjedan?
                </ChatBubble>
            </ChatMessage>
        ),
    },
    {
        id: 'status',
        content: (
            <ChatMarker icon={<Check />} role="status">
                Provjereni su vrt, gredice i zadnje radnje.
            </ChatMarker>
        ),
    },
    {
        id: 'answer',
        content: (
            <ChatMessage avatar={assistantAvatar} header="Suncokret">
                <ChatBubble className="grid gap-2" variant="ghost">
                    <p>
                        Ovaj tjedan kreni sa zalijevanjem rajčice i pregledom
                        mladih listova.
                    </p>
                    <ol className="list-decimal space-y-1 pl-5">
                        <li>Zalij rano ujutro.</li>
                        <li>Ukloni suhe listove.</li>
                        <li>Provjeri potporu uz stabljiku.</li>
                    </ol>
                </ChatBubble>
            </ChatMessage>
        ),
    },
];

const longConversationItems: ChatMessageScrollerProps['items'] = [
    ...conversationItems,
    {
        id: 'follow-up-question',
        scrollAnchor: true,
        content: (
            <ChatMessage align="end">
                <ChatBubble align="end" variant="sunflower">
                    Trebam li danas ponovno zalijevati?
                </ChatBubble>
            </ChatMessage>
        ),
    },
    {
        id: 'follow-up-answer',
        content: (
            <ChatMessage avatar={assistantAvatar} header="Suncokret">
                <ChatBubble className="grid gap-2" variant="ghost">
                    <p>
                        Pričekaj večer i prvo provjeri vlagu nekoliko
                        centimetara ispod površine zemlje.
                    </p>
                    <p>
                        Ako je zemlja još vlažna, preskoči zalijevanje i
                        provjeri ponovno sutra ujutro.
                    </p>
                </ChatBubble>
            </ChatMessage>
        ),
    },
    {
        id: 'second-follow-up-question',
        scrollAnchor: true,
        content: (
            <ChatMessage align="end">
                <ChatBubble align="end" variant="sunflower">
                    Što mogu pripremiti za vikend?
                </ChatBubble>
            </ChatMessage>
        ),
    },
    {
        id: 'second-follow-up-answer',
        content: (
            <ChatMessage avatar={assistantAvatar} header="Suncokret">
                <ChatBubble variant="ghost">
                    Pripremi vezice za rajčicu i malo malča za zadržavanje
                    vlage.
                </ChatBubble>
            </ChatMessage>
        ),
    },
];

function ChatPanel(props: ChatMessageScrollerProps) {
    return (
        <div className="grid min-h-screen place-items-center p-4">
            <div className="flex h-[36rem] w-full max-w-[27.5rem] flex-col overflow-hidden rounded-2xl border border-amber-200/80 border-b-4 border-b-emerald-700 bg-background shadow-2xl dark:border-amber-900/80">
                <Row
                    justifyContent="space-between"
                    className="border-b border-amber-200/70 bg-amber-50/80 px-3.5 py-3 dark:border-amber-900/70 dark:bg-amber-950/30"
                >
                    <Row spacing={2}>
                        <span className="grid size-10 place-items-center rounded-full border border-amber-200 bg-background">
                            <Sun className="size-5 text-amber-500" />
                        </span>
                        <Stack spacing={0}>
                            <Typography level="body2" semiBold>
                                Suncokret
                            </Typography>
                            <Typography
                                level="body3"
                                className="text-muted-foreground"
                            >
                                <span className="mr-1.5 inline-block size-1.5 rounded-full bg-emerald-500 align-middle" />
                                Razgovor za Gredicu A12
                            </Typography>
                        </Stack>
                    </Row>
                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                        AI pomoćnik
                    </span>
                </Row>

                <ChatMessageScroller className="flex-1" {...props} />

                <div className="border-t bg-background p-3">
                    <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
                        <textarea
                            aria-label="Pitaj Suncokret"
                            className="min-h-14 w-full resize-none border-0 bg-transparent px-4 py-3 text-sm outline-hidden placeholder:text-muted-foreground"
                            placeholder="Pitaj Suncokret..."
                        />
                        <Row
                            justifyContent="space-between"
                            className="border-t border-border/60 px-2 py-2"
                        >
                            <Typography
                                level="body3"
                                className="px-1 text-muted-foreground"
                            >
                                Enter šalje poruku
                            </Typography>
                            <IconButton
                                disabled
                                title="Pošalji"
                                className="size-9 rounded-full bg-emerald-700 text-white"
                            >
                                <Send className="size-4" />
                            </IconButton>
                        </Row>
                    </div>
                </div>
            </div>
        </div>
    );
}

const meta = {
    title: 'packages/ui/Chat',
    component: ChatMessageScroller,
    tags: ['autodocs'],
    parameters: {
        layout: 'fullscreen',
        docs: {
            description: {
                component:
                    'Composable chat rows, bubbles, markers, and a streaming-safe message scroller adapted from the shadcn chat primitives for Gredice surfaces.',
            },
        },
    },
} satisfies Meta<typeof ChatMessageScroller>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Conversation: Story = {
    args: {
        ariaLabel: 'Razgovor sa Suncokretom',
        items: conversationItems,
    },
    render: (args) => <ChatPanel {...args} />,
};

export const LongConversation: Story = {
    args: {
        ariaLabel: 'Dugi razgovor sa Suncokretom',
        items: longConversationItems,
    },
    render: (args) => <ChatPanel {...args} />,
};

export const Empty: Story = {
    args: {
        items: [],
        emptyContent: (
            <Stack alignItems="center" spacing={3} className="px-6 text-center">
                <span className="grid size-14 place-items-center rounded-full border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950">
                    <Sun className="size-7 text-amber-500" />
                </span>
                <Stack spacing={1} alignItems="center">
                    <Typography level="h6" semiBold>
                        Kako ti mogu pomoći?
                    </Typography>
                    <Typography
                        level="body3"
                        className="max-w-72 text-muted-foreground"
                    >
                        Pitaj o stanju vrta, sadnji ili radnjama koje slijede.
                    </Typography>
                </Stack>
            </Stack>
        ),
    },
    render: (args) => <ChatPanel {...args} />,
};

export const Streaming: Story = {
    args: {
        ariaBusy: true,
        items: [
            ...conversationItems,
            {
                id: 'streaming',
                content: (
                    <ChatMarker
                        className="px-10"
                        icon={<LoaderSpinner className="animate-spin" />}
                        role="status"
                    >
                        <span className="chat-shimmer">
                            Suncokret razmišlja...
                        </span>
                    </ChatMarker>
                ),
            },
        ],
    },
    render: (args) => <ChatPanel {...args} />,
};
