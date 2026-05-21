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
import { cx } from '@signalco/ui-primitives/cx';
import { useTheme } from 'next-themes';
import { useState } from 'react';
import type { AttributeInputProps } from '../AttributeInputProps';
import '@mdxeditor/editor/style.css';

export function MarkdownInput({ value, onChange }: AttributeInputProps) {
    const { resolvedTheme } = useTheme();
    const [inputValue, setInputValue] = useState<string>(value || '');
    return (
        <div className="overflow-hidden rounded-md border border-input bg-background">
            <MDXEditor
                placeholder="Nema informacija..."
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
                contentEditableClassName="prose prose-p:my-2 prose-sm max-w-none bg-background text-foreground"
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
                                {' '}
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
                markdown={inputValue}
                onChange={setInputValue}
                onBlur={() => onChange(inputValue)}
            />
        </div>
    );
}
