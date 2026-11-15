'use client';

import { Tabs, TabsList, TabsTrigger } from '@gredice/ui/Tabs';
import { cx } from '@gredice/ui/utils';
import { type ReactNode, useId, useState } from 'react';

type AutomationDetailTab = 'editor' | 'runs';

function isAutomationDetailTab(value: string): value is AutomationDetailTab {
    return value === 'editor' || value === 'runs';
}

// Below `xl` the editor and the executions list share the page through tabs;
// from `xl` up the tab list is hidden and both panels sit side by side. The
// panels are hidden with classes instead of `TabsContent` because its `hidden`
// attribute can't be overridden at `xl`, and both stay mounted so the editor
// keeps its graph state and autosave across tab switches and resizes.
export function AutomationDetailLayout({
    editor,
    runs,
}: {
    editor: ReactNode;
    runs: ReactNode;
}) {
    const id = useId();
    const [activeTab, setActiveTab] = useState<AutomationDetailTab>('editor');
    const editorTabId = `${id}-editor-tab`;
    const runsTabId = `${id}-runs-tab`;

    return (
        <Tabs
            value={activeTab}
            onValueChange={(value) => {
                if (isAutomationDetailTab(value)) {
                    setActiveTab(value);
                }
            }}
            className="flex min-w-0 flex-col gap-3"
        >
            <TabsList className="grid w-full grid-cols-2 xl:hidden">
                <TabsTrigger id={editorTabId} value="editor">
                    Uređivač
                </TabsTrigger>
                <TabsTrigger id={runsTabId} value="runs">
                    Izvršavanja
                </TabsTrigger>
            </TabsList>
            <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_380px] 2xl:grid-cols-[minmax(0,1fr)_440px]">
                <div
                    role="tabpanel"
                    aria-labelledby={editorTabId}
                    className={cx(
                        'min-w-0 flex-col',
                        activeTab === 'editor' ? 'flex' : 'hidden xl:flex',
                    )}
                >
                    {editor}
                </div>
                <div
                    role="tabpanel"
                    aria-labelledby={runsTabId}
                    className={cx(
                        'min-w-0 flex-col xl:relative',
                        activeTab === 'runs' ? 'flex' : 'hidden xl:flex',
                    )}
                >
                    {/* On desktop the runs column takes the editor's height and scrolls inside. */}
                    <div className="flex min-w-0 flex-col xl:absolute xl:inset-0">
                        {runs}
                    </div>
                </div>
            </div>
        </Tabs>
    );
}
