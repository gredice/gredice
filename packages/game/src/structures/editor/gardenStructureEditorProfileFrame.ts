export function scheduleGardenStructureEditorProfileFrame({
    enabled,
    onFrame,
    requestFrame,
}: Readonly<{
    enabled: boolean;
    onFrame: FrameRequestCallback;
    requestFrame: (callback: FrameRequestCallback) => number;
}>) {
    if (!enabled) {
        return false;
    }
    requestFrame(onFrame);
    return true;
}
