import { PlantPerformanceViewerDynamic } from './PlantPerformanceViewerDynamic';

export default function DebugPlantsPage() {
    return (
        <div className="flex h-screen w-screen flex-col bg-neutral-900">
            <div className="border-b border-neutral-700 p-4">
                <h1 className="text-xl font-bold text-white">
                    Plant Performance Debug View
                </h1>
                <p className="text-sm text-neutral-400">
                    Generated presets rendered in dense batches for rollout
                    validation.
                </p>
            </div>
            <div className="flex-1">
                <PlantPerformanceViewerDynamic />
            </div>
        </div>
    );
}
