import { SandboxDebugActions } from '../sandbox/SandboxDebugActions';
import { EntityGridViewerDynamic } from './EntityGridViewerDynamic';
import { entityGridSandboxStorageKey } from './entitySandboxStorage';

export default function DebugEntitiesPage() {
    return (
        <div className="flex h-screen w-screen flex-col bg-[#e7e2cc]">
            <div className="border-b border-neutral-700 bg-neutral-950 p-4">
                <h1 className="text-xl font-bold text-white">Entity Sandbox</h1>
                <p className="text-neutral-400 text-sm">
                    Displaying sandbox blocks in positioned stacks
                </p>
            </div>
            <div className="relative min-h-0 flex-1">
                <EntityGridViewerDynamic
                    storageKey={entityGridSandboxStorageKey}
                />
                <SandboxDebugActions storageKey={entityGridSandboxStorageKey} />
            </div>
        </div>
    );
}
