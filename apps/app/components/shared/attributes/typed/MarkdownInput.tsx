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
        <div className="rounded-md border">
            <MDXEditor
                placeholder="Nema informacija..."
                className={cx(
                    '[&_.mdxeditor-toolbar]:bg-transparent',
                    resolvedTheme === 'dark' && 'dark-theme',
                )}
                contentEditableClassName="prose prose-p:my-2 prose-sm max-w-none"
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
