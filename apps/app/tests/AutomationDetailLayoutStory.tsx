import { AutomationDetailLayout } from '../app/admin/automations/AutomationDetailLayout';
import { AutomationSlidePanel } from '../app/admin/automations/AutomationSlidePanel';

const runIds = Array.from({ length: 40 }, (_, index) => index + 1);

function EditorStub({ panelOpen }: { panelOpen: boolean }) {
    return (
        <div
            data-testid="editor"
            className="h-[600px] rounded-md border bg-background"
        >
            Graf
            <AutomationSlidePanel
                open={panelOpen}
                title="Detalji"
                onOpenChange={() => undefined}
            >
                Postavke automatizacije
            </AutomationSlidePanel>
        </div>
    );
}

function RunsStub() {
    return (
        <div
            data-testid="runs"
            className="flex min-h-0 flex-col overflow-hidden rounded-md border"
        >
            <h2 className="shrink-0 border-b p-4">Izvršavanja</h2>
            <ul data-testid="runs-list" className="min-h-0 overflow-y-auto">
                {runIds.map((runId) => (
                    <li key={runId} className="h-20 border-b p-4">
                        Izvršavanje #{runId}
                    </li>
                ))}
            </ul>
        </div>
    );
}

export function AutomationDetailLayoutStory({
    editorPanelOpen = false,
}: {
    editorPanelOpen?: boolean;
}) {
    return (
        <AutomationDetailLayout
            editor={<EditorStub panelOpen={editorPanelOpen} />}
            runs={<RunsStub />}
        />
    );
}
