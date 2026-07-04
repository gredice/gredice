'use client';

import {
    markdownEditorClassNames,
    markdownEditorContentEditableClassName,
} from '@gredice/ui/MarkdownEditor';
import { cx } from '@gredice/ui/utils';
import {
    BlockTypeSelect,
    BoldItalicUnderlineToggles,
    CreateLink,
    headingsPlugin,
    InsertThematicBreak,
    ListsToggle,
    linkDialogPlugin,
    linkPlugin,
    listsPlugin,
    MDXEditor,
    markdownShortcutPlugin,
    quotePlugin,
    Separator,
    thematicBreakPlugin,
    toolbarPlugin,
    UndoRedo,
} from '@mdxeditor/editor';
import '@mdxeditor/editor/style.css';

export function CommunityMarkdownInput({
    id,
    onChange,
    value,
}: {
    id: string;
    onChange: (value: string) => void;
    value: string;
}) {
    return (
        <div className="overflow-hidden rounded-md border border-border/80 bg-card shadow-sm ring-offset-background transition-colors hover:border-primary/40 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
            <MDXEditor
                className={cx(
                    markdownEditorClassNames,
                    "[&_[class*='contentEditable']]:min-h-32",
                )}
                contentEditableClassName={cx(
                    markdownEditorContentEditableClassName,
                    'min-h-32 bg-card',
                )}
                markdown={value}
                onChange={onChange}
                placeholder="Upiši prijedlog..."
                plugins={[
                    headingsPlugin(),
                    listsPlugin(),
                    quotePlugin(),
                    thematicBreakPlugin(),
                    linkPlugin(),
                    linkDialogPlugin(),
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
                                <InsertThematicBreak />
                                <ListsToggle />
                            </>
                        ),
                    }),
                ]}
                aria-label={id}
            />
        </div>
    );
}
