'use client';

import {
    BlockTypeSelect,
    BoldItalicUnderlineToggles,
    headingsPlugin,
    InsertImage,
    InsertThematicBreak,
    imagePlugin,
    ListsToggle,
    listsPlugin,
    MDXEditor,
    type MDXEditorMethods,
    markdownShortcutPlugin,
    quotePlugin,
    Separator,
    thematicBreakPlugin,
    toolbarPlugin,
    UndoRedo,
} from '@mdxeditor/editor';
import '@mdxeditor/editor/style.css';
import type { NewsletterAudienceSummary } from '@gredice/storage';
import { Alert } from '@signalco/ui/Alert';
import { Megaphone, Send } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import {
    Card,
    CardActions,
    CardContent,
    CardHeader,
    CardTitle,
} from '@signalco/ui-primitives/Card';
import { cx } from '@signalco/ui-primitives/cx';
import { Input } from '@signalco/ui-primitives/Input';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import {
    useActionState,
    useCallback,
    useEffect,
    useRef,
    useState,
} from 'react';
import {
    type NewsletterSendState,
    sendNewsletterAction,
    uploadNewsletterImageAction,
} from './actions';

interface NewsletterFormProps {
    audience: NewsletterAudienceSummary;
}

export function NewsletterForm({ audience }: NewsletterFormProps) {
    const editorRef = useRef<MDXEditorMethods>(null);
    const messageRef = useRef<HTMLInputElement>(null);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [state, formAction, pending] = useActionState<
        NewsletterSendState | null,
        FormData
    >(sendNewsletterAction, null);

    const summary = state?.summary ?? audience;
    useEffect(() => {
        if (state?.success) {
            setUploadError(null);
            if (messageRef.current) {
                messageRef.current.value = '';
            }
            if (editorRef.current) {
                editorRef.current.setMarkdown('');
            }
        }
    }, [state?.success]);
    const handleImageUpload = useCallback(async (file: File) => {
        const formData = new FormData();
        formData.append('image', file);
        formData.append('fileName', file.name);
        try {
            const result = await uploadNewsletterImageAction(formData);
            if (!result?.success || !result.url) {
                const message =
                    result?.error ??
                    'Neuspjelo učitavanje slike. Pokušaj ponovno.';
                setUploadError(message);
                throw new Error(message);
            }
            setUploadError(null);
            return result.url;
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Neuspjelo učitavanje slike. Pokušaj ponovno.';
            setUploadError(message);
            throw error;
        }
    }, []);

    const disableSend = pending || summary.total === 0;

    const duplicateInfo = summary.duplicateCount > 0;

    return (
        <Stack spacing={2}>
            <Card>
                <CardHeader>
                    <Row spacing={1} className="items-center">
                        <Megaphone className="size-5" />
                        <CardTitle>Primatelji</CardTitle>
                    </Row>
                </CardHeader>
                <CardContent>
                    <Row spacing={4} className="flex-wrap gap-y-4">
                        <Stack spacing={0.5}>
                            <Typography className="text-sm" bold>
                                Ukupno primatelja
                            </Typography>
                            <Typography className="text-lg font-semibold">
                                {summary.total.toLocaleString('hr-HR')}
                            </Typography>
                        </Stack>
                        <Stack spacing={0.5}>
                            <Typography className="text-sm" bold>
                                Pretplatnici
                            </Typography>
                            <Typography>
                                {summary.subscriberCount.toLocaleString(
                                    'hr-HR',
                                )}
                            </Typography>
                        </Stack>
                        <Stack spacing={0.5}>
                            <Typography className="text-sm" bold>
                                Korisnici
                            </Typography>
                            <Typography>
                                {summary.optedInUserCount.toLocaleString(
                                    'hr-HR',
                                )}
                            </Typography>
                        </Stack>
                        <Stack spacing={0.5}>
                            <Typography className="text-sm" bold>
                                Duplikati
                            </Typography>
                            <Typography>
                                {summary.duplicateCount.toLocaleString('hr-HR')}
                            </Typography>
                        </Stack>
                    </Row>
                    {duplicateInfo && (
                        <Typography
                            level="body2"
                            className="text-muted-foreground mt-3"
                        >
                            Duplikati se automatski uklanjaju pa svaka adresa
                            prima samo jednu poruku.
                        </Typography>
                    )}
                    {summary.total === 0 && (
                        <Alert className="mt-4" color="warning">
                            Trenutno nema prijavljenih primatelja za newsletter.
                        </Alert>
                    )}
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <Row spacing={1} className="items-center">
                        <Send className="size-5" />
                        <CardTitle>Pošalji newsletter</CardTitle>
                    </Row>
                </CardHeader>
                <form action={formAction}>
                    <CardContent>
                        <Stack spacing={3}>
                            {state?.message && (
                                <Alert
                                    color={state.success ? 'success' : 'danger'}
                                    className="mb-2"
                                >
                                    <Stack spacing={1}>
                                        <Typography>{state.message}</Typography>
                                        <Typography className="text-sm text-muted-foreground">
                                            Poslano:{' '}
                                            {state.sent.toLocaleString('hr-HR')}{' '}
                                            /{' '}
                                            {summary.total.toLocaleString(
                                                'hr-HR',
                                            )}{' '}
                                            (neuspjelo:{' '}
                                            {state.failed.toLocaleString(
                                                'hr-HR',
                                            )}
                                            )
                                        </Typography>
                                    </Stack>
                                </Alert>
                            )}
                            {state?.errors && state.errors.length > 0 && (
                                <Alert color="warning" className="mb-2">
                                    <Stack spacing={1}>
                                        <Typography bold>
                                            Slanje je preskočeno za sljedeće
                                            adrese:
                                        </Typography>
                                        <ul className="list-disc pl-5 space-y-1 text-sm">
                                            {state.errors.map((error) => (
                                                <li key={error.email}>
                                                    <span className="font-medium">
                                                        {error.email}
                                                    </span>{' '}
                                                    – {error.message}
                                                </li>
                                            ))}
                                        </ul>
                                    </Stack>
                                </Alert>
                            )}
                            <Stack spacing={2}>
                                <Input
                                    name="subject"
                                    label="Naslov"
                                    placeholder="Unesi naslov newslettera"
                                    required
                                    disabled={pending}
                                />
                                <Input
                                    name="header"
                                    label="Zaglavlje (naslov unutar emaila)"
                                    placeholder="Gredice Newsletter"
                                    disabled={pending}
                                />
                                <Input
                                    name="previewText"
                                    label="Tekst pregleda"
                                    placeholder="Kratka poruka koja se prikazuje u pretpregledu sandučića"
                                    disabled={pending}
                                />
                                <Stack spacing={1}>
                                    <input
                                        ref={messageRef}
                                        type="hidden"
                                        name="content"
                                    />
                                    <Typography className="text-sm" bold>
                                        Sadržaj (Markdown)
                                    </Typography>
                                    <MDXEditor
                                        ref={editorRef}
                                        readOnly={pending}
                                        markdown=""
                                        onChange={(value) => {
                                            if (messageRef.current) {
                                                messageRef.current.value =
                                                    value;
                                            }
                                        }}
                                        placeholder="Unesi sadržaj newslettera..."
                                        className={cx(
                                            'border rounded-md bg-background',
                                            pending &&
                                                'opacity-60 pointer-events-none',
                                            '[&_.mdxeditor-toolbar]:bg-background',
                                            '[&_.mdxeditor-toolbar]:text-muted-foreground',
                                        )}
                                        contentEditableClassName="prose prose-p:my-2 prose-sm max-w-none"
                                        plugins={[
                                            headingsPlugin(),
                                            listsPlugin(),
                                            quotePlugin(),
                                            thematicBreakPlugin(),
                                            markdownShortcutPlugin(),
                                            imagePlugin({
                                                imageUploadHandler:
                                                    handleImageUpload,
                                                allowSetImageDimensions: true,
                                            }),
                                            toolbarPlugin({
                                                toolbarContents: () => (
                                                    <>
                                                        <UndoRedo />
                                                        <Separator />
                                                        <BlockTypeSelect />
                                                        <BoldItalicUnderlineToggles />
                                                        <Separator />
                                                        <InsertImage />
                                                        <Separator />
                                                        <InsertThematicBreak />
                                                        <ListsToggle />
                                                    </>
                                                ),
                                            }),
                                        ]}
                                    />
                                    {uploadError && (
                                        <Alert color="danger">
                                            {uploadError}
                                        </Alert>
                                    )}
                                    <Typography className="text-xs text-muted-foreground">
                                        Slike dodaj pomoću gumba za umetanje
                                        slike u alatnoj traci. Datoteke se
                                        automatski prenose na CDN i možeš ih
                                        koristiti kroz Markdown sintaksu.
                                    </Typography>
                                </Stack>
                            </Stack>
                        </Stack>
                    </CardContent>
                    <CardActions className="justify-between">
                        <Typography className="text-sm text-muted-foreground">
                            Newsletter će biti poslan na{' '}
                            {summary.total.toLocaleString('hr-HR')} adres
                            {summary.total === 1 ? 'u' : 'e'}.
                        </Typography>
                        <Button
                            type="submit"
                            variant="solid"
                            startDecorator={<Send className="size-4" />}
                            loading={pending}
                            disabled={disableSend}
                        >
                            Pošalji newsletter
                        </Button>
                    </CardActions>
                </form>
            </Card>
        </Stack>
    );
}
