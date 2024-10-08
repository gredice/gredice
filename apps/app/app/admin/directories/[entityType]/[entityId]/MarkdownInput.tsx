'use client';

import { MDXEditor, UndoRedo, BoldItalicUnderlineToggles, toolbarPlugin, markdownShortcutPlugin, headingsPlugin, listsPlugin, quotePlugin, thematicBreakPlugin, BlockTypeSelect, ChangeAdmonitionType, CreateLink, InsertAdmonition, InsertTable, InsertThematicBreak, ListsToggle, Separator } from "@mdxeditor/editor";
import { useState } from "react";
import { AttributeInputProps } from "./AttributeInput";

export function MarkdownInput({ value, onChange }: AttributeInputProps) {
    const [inputValue, setInputValue] = useState<string>(value || '');
    return (
        <div className="rounded-md border">
            <MDXEditor
                placeholder="Nema informacija..."
                className="[&_.mdxeditor-toolbar]:bg-background [&_.mdxeditor-toolbar]:text-muted-foreground"
                contentEditableClassName="prose prose-sm max-w-none"
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
                                <CreateLink />
                                <InsertTable />
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
