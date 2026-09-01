export function scheduleGardenStructureEditorProfileFrame({
    enabled,
    now,
    onDuration,
    requestFrame,
    startedAt,
}: Readonly<{
    enabled: boolean;
    now: () => number;
    onDuration: (durationMs: number) => void;
    requestFrame: (callback: FrameRequestCallback) => number;
    startedAt: number;
}>) {
    if (!enabled) {
        return false;
    }
    requestFrame(() => onDuration(now() - startedAt));
    return true;
}
