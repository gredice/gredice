'use client';

import {
    markdownEditorClassNames,
    markdownEditorContentEditableClassName,
} from '@gredice/ui/MarkdownEditor';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import {
    BlockTypeSelect,
    BoldItalicUnderlineToggles,
    CreateLink,
    headingsPlugin,
    InsertImage,
    InsertThematicBreak,
    imagePlugin,
    ListsToggle,
    linkDialogPlugin,
    linkPlugin,
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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { uploadCmsMarkdownImage } from './actions';

type CmsPageMarkdownEditorProps = {
    value: string;
    label?: string;
    variant?: 'panel' | 'inline';
    required?: boolean;
    helperText?: string;
    placeholder?: string;
    error?: string;
    onChange: (value: string) => void;
};

function markdownImageUploadErrorMessage(error: unknown) {
    if (error instanceof Error && error.message) {
        return error.message;
    }

    return 'Ucitavanje slike nije uspjelo.';
}

export function CmsPageMarkdownEditor({
    error,
    helperText,
    label,
    onChange,
    placeholder,
    required,
    variant = 'panel',
    value,
}: CmsPageMarkdownEditorProps) {
    const editorRef = useRef<MDXEditorMethods>(null);
    const [inputValue, setInputValue] = useState(value);
    const [uploadError, setUploadError] = useState<string | null>(null);

    useEffect(() => {
        if (value === inputValue) {
            return;
        }

        setInputValue(value);
        editorRef.current?.setMarkdown(value);
    }, [inputValue, value]);

    const uploadImage = useCallback(async (file: File) => {
        try {
            setUploadError(null);
            const formData = new FormData();
            formData.append('file', file);
            const result = await uploadCmsMarkdownImage(formData);
            return result.url;
        } catch (uploadImageError) {
            const message = markdownImageUploadErrorMessage(uploadImageError);
            setUploadError(message);
            throw new Error(message);
        }
    }, []);

    const plugins = useMemo(
        () => [
            headingsPlugin(),
            listsPlugin(),
            quotePlugin(),
            thematicBreakPlugin(),
            linkPlugin(),
            linkDialogPlugin(),
            imagePlugin({
                imageUploadHandler: uploadImage,
            }),
            markdownShortcutPlugin(),
            toolbarPlugin({
                toolbarContents: () => (
                    <>
                        <UndoRedo />
                        <Separator />
                        <BlockTypeSelect />
                        <BoldItalicUnderlineToggles />
                        <Separator />
                        <CreateLink />
                        <InsertImage />
                        <InsertThematicBreak />
                        <ListsToggle />
                    </>
                ),
            }),
        ],
        [uploadImage],
    );
    const showLabelBlock = Boolean(label || helperText);
    const editorShellClassName =
        variant === 'inline'
            ? 'bg-transparent'
            : 'overflow-hidden rounded-md border border-input bg-background';

    return (
        <div className="space-y-2">
            {showLabelBlock ? (
                <div className="space-y-1">
                    {label ? (
                        <Typography level="body2" semiBold>
                            {label}
                            {required && (
                                <span className="text-red-600"> *</span>
                            )}
                        </Typography>
                    ) : null}
                    {helperText ? (
                        <Typography level="body3" secondary>
                            {helperText}
                        </Typography>
                    ) : null}
                </div>
            ) : null}
            <div className={editorShellClassName}>
                <MDXEditor
                    ref={editorRef}
                    className={cx(markdownEditorClassNames)}
                    contentEditableClassName={cx(
                        markdownEditorContentEditableClassName,
                        variant === 'inline' ? 'min-h-[32rem]' : 'min-h-64',
                    )}
                    markdown={inputValue}
                    onChange={(nextValue) => {
                        setInputValue(nextValue);
                        onChange(nextValue);
                        if (uploadError) {
                            setUploadError(null);
                        }
                    }}
                    placeholder={placeholder ?? 'Upisi Markdown sadrzaj...'}
                    plugins={plugins}
                />
            </div>
            {uploadError ? (
                <Typography level="body3" className="text-red-600">
                    {uploadError}
                </Typography>
            ) : null}
            {error ? (
                <Typography level="body3" className="text-red-600">
                    {error}
                </Typography>
            ) : null}
        </div>
    );
}
