import { Stack } from "./Stack";

export type Garden = {
    id: string;
    name: string;
    stacks: Stack[];
    location: {
        lat: number;
        lon: number;
    }
}