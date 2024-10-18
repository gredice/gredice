import { Stack } from "./Stack";

export type Garden = {
    name: string;
    stacks: Stack[];
    location: {
        lat: number;
        lon: number;
    }
}