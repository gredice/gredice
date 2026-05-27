import { EntityGridViewerDynamic } from './EntityGridViewerDynamic';

export default function DebugEntitiesPage() {
    return (
        <div className="flex h-screen w-screen flex-col bg-[#e7e2cc]">
            <div className="border-b border-neutral-700 bg-neutral-950 p-4">
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
