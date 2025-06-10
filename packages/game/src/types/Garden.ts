import { Stack } from "./Stack";

export type Garden = {
    id: number;
    name: string;
    stacks: Stack[];
    location: {
        lat: number;
        lon: number;
    },
    raisedBeds: {
        id: number;
        name: string;
        blockId: string;
    }[]
}