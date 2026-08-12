export type OutletGardenRenderer = 'list' | 'webgl';

export type OutletGardenSceneFailureReason = 'context_lost';

export type OutletGardenFallbackReason =
    | OutletGardenSceneFailureReason
    | 'constrained_device'
    | 'scene_load_error'
    | 'scene_ready_timeout'
    | 'unsupported_webgl'
    | 'user';
