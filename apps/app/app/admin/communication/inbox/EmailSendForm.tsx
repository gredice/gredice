'use client';

import { Avatar } from '@gredice/ui/Avatar';
import { Button } from '@gredice/ui/Button';
import {
    Card,
    CardActions,
    CardContent,
    CardHeader,
    CardTitle,
} from '@gredice/ui/Card';
import { Input } from '@gredice/ui/Input';
import { Clear, Mail, Send } from '@gredice/ui/icons';
import {
    markdownEditorClassNames,
    markdownEditorContentEditableClassName,
} from '@gredice/ui/MarkdownEditor';
import { Typography } from '@gredice/ui/Typography';
import {
    BlockTypeSelect,
    BoldItalicUnderlineToggles,
    headingsPlugin,
    InsertThematicBreak,
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
import { IconButton } from '@gredice/ui/IconButton';
import { File, Paperclip } from '@gredice/ui/icons';
import { Progress } from '@gredice/ui/Progress';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { cx } from '@gredice/ui/utils';
import {
    type ChangeEvent,
    useActionState,
    useCallback,
    useEffect,
    useRef,
    useState,
} from 'react';
import { submitEmailForm } from './actions';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes

export function EmailSendForm({ from }: { from: string }) {
    const messageRef = useRef<HTMLInputElement>(null);
    const editorRef = useRef<MDXEditorMethods>(null);
    const [attachments, setAttachments] = useState<File[]>([]);
    const [state, formAction, pending] = useActionState(
        submitEmailForm.bind(null, attachments),
        null,
    );
    const [totalSize, setTotalSize] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (state?.success) {
            setAttachments([]);
            setTotalSize(0);
            if (messageRef.current) messageRef.current.value = '';
            if (editorRef.current) editorRef.current.setMarkdown('');
        }
    }, [state?.success]);

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files);
            const newTotalSize =
                totalSize + newFiles.reduce((acc, file) => acc + file.size, 0);

            if (newTotalSize <= MAX_FILE_SIZE) {
                setAttachments((prev) => [...prev, ...newFiles]);
                setTotalSize(newTotalSize);
            } else {
                alert(
                    'Ukupna veličina priloga prelazi maksimalnu dozvoljenu veličinu od 10MB. Molimo uklonite neke priloge ili smanjite veličinu priloga.',
                );
                const allowedFiles: File[] = [];
                let allowedSize = totalSize;
                for (const file of newFiles) {
                    if (allowedSize + file.size <= MAX_FILE_SIZE) {
                        allowedFiles.push(file);
                        allowedSize += file.size;
                    } else {
                        break;
                    }
                }
                setAttachments((prev) => [...prev, ...allowedFiles]);
                setTotalSize(allowedSize);
            }
        }
    };

    const removeAttachment = useCallback((index: number) => {
        setAttachments((prev) => {
            const newAttachments = [...prev];
            const [removedFile] = newAttachments.splice(index, 1);
            setTotalSize((prev) => prev - removedFile.size);
            return newAttachments;
        });
    }, []);

    const fileSizePercentage = (totalSize / MAX_FILE_SIZE) * 100;

    return (
        <Card>
            <CardHeader>
                <Row spacing={2}>
                    <Mail className="size-6" />
                    <CardTitle>Novi email</CardTitle>
                </Row>
            </CardHeader>
            <form action={formAction}>
                <CardContent>
                    <Stack spacing={4}>
                        <Stack spacing={2}>
                            <Stack spacing={2}>
                                <Typography className="text-sm" bold>
                                    Od
                                </Typography>
                                <Row spacing={2}>
                                    <Avatar>U</Avatar>
                                    <div className="flex-grow">
                                        <Input
                                            id="from"
                                            type="email"
                                            value={from}
                                            readOnly
                                            className="bg-muted"
                                            fullWidth
                                        />
                                    </div>
                                </Row>
                            </Stack>
                            <Input
                                disabled={pending}
                                name="to"
                                label="Za"
                                type="email"
                                placeholder="primatelj@example.com"
                                required
                                fullWidth
                            />
                            <Input
                                disabled={pending}
                                name="subject"
                                label="Naslov"
                                type="text"
                                placeholder="Unesite naslov..."
                                required
                                fullWidth
                            />
                            <Stack spacing={2}>
                                <input
                                    type="hidden"
                                    name="message"
                                    ref={messageRef}
                                />
                                <Typography className="text-sm" bold>
                                    Poruka
                                </Typography>
                                <MDXEditor
                                    ref={editorRef}
                                    readOnly={pending}
                                    markdown=""
                                    onChange={(value) => {
                                        if (messageRef.current)
                                            messageRef.current.value = value;
                                    }}
                                    placeholder="Unesite poruku..."
                                    className={cx(
                                        markdownEditorClassNames,
                                        'rounded-md border',
                                        pending && 'bg-muted',
                                    )}
                                    contentEditableClassName={
                                        markdownEditorContentEditableClassName
                                    }
                                    plugins={[
                                        headingsPlugin(),
                                        listsPlugin(),
                                        quotePlugin(),
                                        thematicBreakPlugin(),
                                        markdownShortcutPlugin(),
                                        toolbarPlugin({
                                            toolbarContents: () => (
                                                <>
                                                    {' '}
                                                    <UndoRedo />
                                                    <Separator />
                                                    <BlockTypeSelect />
                                                    <BoldItalicUnderlineToggles />
                                                    <Separator />
                                                    <InsertThematicBreak />
                                                    <ListsToggle />
                                                </>
                                            ),
                                        }),
                                    ]}
                                />
                            </Stack>
                            {attachments.length > 0 && (
                                <Stack>
                                    <Typography className="text-sm" bold>
                                        Prilozi
                                    </Typography>
                                    {attachments.length > 0 && (
                                        <div className="mt-2 space-y-2">
                                            {attachments.map((file, index) => (
                                                <div
                                                    // biome-ignore lint/suspicious/noArrayIndexKey: No better key
                                                    key={index}
                                                    className="border p-3 rounded-md text-sm flex items-center justify-between"
                                                >
                                                    <Row spacing={2}>
                                                        <File className="size-5" />
                                                        <Typography>
                                                            {file.name} (
                                                            {(
                                                                file.size /
                                                                1024 /
                                                                1024
                                                            ).toFixed(2)}{' '}
                                                            MB)
                                                        </Typography>
                                                    </Row>
                                                    <IconButton
                                                        title="Ukloni prilog"
                                                        type="button"
                                                        variant="plain"
                                                        size="sm"
                                                        className="size-5 p-0"
                                                        onClick={() =>
                                                            removeAttachment(
                                                                index,
                                                            )
                                                        }
                                                    >
                                                        <Clear className="h-3 w-3" />
                                                    </IconButton>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <div className="mt-2">
                                        <Progress
                                            value={fileSizePercentage}
                                            className="w-full"
                                        />
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Max.{' '}
                                            {(totalSize / 1024 / 1024).toFixed(
                                                2,
                                            )}{' '}
                                            MB / 10 MB
                                        </p>
                                    </div>
                                </Stack>
                            )}
                        </Stack>
                        <CardActions>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                className="hidden"
                                multiple
                            />
                            <input
                                type="hidden"
                                name="attachments"
                                value={attachments
                                    .map(({ name }) => name)
                                    .join(',')}
                            />
                            <Button
                                type="button"
                                variant="outlined"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={totalSize >= MAX_FILE_SIZE}
                                startDecorator={
                                    <Paperclip className="size-4" />
                                }
                            >
                                Dodaj prilog
                            </Button>
                            <Button
                                variant="solid"
                                type="submit"
                                startDecorator={<Send className="size-4" />}
                                loading={pending}
                                disabled={pending}
                            >
                                Pošalji
                            </Button>
                        </CardActions>
                    </Stack>
                </CardContent>
            </form>
        </Card>
    );
}
