import type { GardenAvatarView } from '../../useGameState';

export type GardenAvatarPresenceState = {
    crouchAmount: number;
    grounded: boolean;
    headPitch: number;
    movingSpeed: number;
    position: [number, number, number];
    view: GardenAvatarView;
    yaw: number;
};

export type GardenVisitorPresence = GardenAvatarPresenceState & {
    id: string;
    updatedAt: number;
};

export type GardenVisitorPresenceController = {
    localVisitorId: string;
    onLocalPresenceChange: (presence: GardenAvatarPresenceState) => void;
    visitors: GardenVisitorPresence[];
};
