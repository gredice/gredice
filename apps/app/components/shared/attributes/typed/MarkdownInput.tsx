import { MDXEditor, UndoRedo, BoldItalicUnderlineToggles, toolbarPlugin, markdownShortcutPlugin, headingsPlugin, listsPlugin, quotePlugin, thematicBreakPlugin, BlockTypeSelect, CreateLink, InsertThematicBreak, ListsToggle, Separator, linkPlugin, linkDialogPlugin } from "@mdxeditor/editor";
import { useState } from "react";
import { AttributeInputProps } from '../AttributeInputProps';
import { useTheme } from "next-themes";
import { cx } from "@signalco/ui-primitives/cx";
import '@mdxeditor/editor/style.css'

export function MarkdownInput({ value, onChange }: AttributeInputProps) {
    const { resolvedTheme } = useTheme();
    const [inputValue, setInputValue] = useState<string>(value || '');
    return (
        <div className="rounded-md border">
            <MDXEditor
                placeholder="Nema informacija..."
                className={cx(
                    "[&_.mdxeditor-toolbar]:bg-transparent",
                    resolvedTheme === 'dark' && "dark-theme"
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
                        )
                    })
                ]}
                markdown={inputValue}
                onChange={setInputValue}
                onBlur={() => onChange(inputValue)}
            />
        </div>
    );
}
