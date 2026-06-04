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
import { useState } from 'react';
import type { AttributeInputProps } from '../AttributeInputProps';
import '@mdxeditor/editor/style.css';

export function MarkdownInput({ value, onChange }: AttributeInputProps) {
    const [inputValue, setInputValue] = useState<string>(value || '');
    return (
        <div className="overflow-hidden rounded-md border border-input bg-background">
            <MDXEditor
                placeholder="Nema informacija..."
                className={cx(markdownEditorClassNames)}
                contentEditableClassName={
                    markdownEditorContentEditableClassName
                }
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
