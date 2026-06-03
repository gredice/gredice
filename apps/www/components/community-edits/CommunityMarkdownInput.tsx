'use client';

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
import { useTheme } from 'next-themes';
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
    const { resolvedTheme } = useTheme();

    return (
        <div className="overflow-hidden rounded-md border border-input bg-background">
            <MDXEditor
                className={cx(
                    'bg-background text-foreground',
                    '[&_.mdxeditor-toolbar]:bg-background [&_.mdxeditor-toolbar]:text-muted-foreground',
                    "[&_[class*='SelectTrigger']]:bg-background",
                    "[&_[class*='SelectTrigger']]:text-foreground",
                    "[&_[class*='DropdownContainer']]:bg-background",
                    "[&_[class*='CodeBlockLanguageSelectContent']]:bg-background",
                    "[&_[class*='selectItem']]:bg-background",
                    "[&_[class*='contentEditable']]:bg-background",
                    resolvedTheme === 'dark' && 'dark-theme',
                )}
                contentEditableClassName="prose prose-p:my-2 prose-sm max-w-none min-h-32 bg-background text-foreground"
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
