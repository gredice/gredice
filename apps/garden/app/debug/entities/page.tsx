import { EntityGridViewerDynamic } from './EntityGridViewerDynamic';

export default function DebugEntitiesPage() {
    return (
        <div className="h-screen w-screen bg-neutral-900 flex flex-col">
            <div className="p-4 border-b border-neutral-700">
                <h1 className="text-xl font-bold text-white">
                    Entity Debug View
                </h1>
                <p className="text-neutral-400 text-sm">
                    Displaying all entities/blocks
                </p>
            </div>
            <div className="flex-1">
                <EntityGridViewerDynamic />
            </div>
        </div>
    );
}
