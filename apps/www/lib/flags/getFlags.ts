import "server-only";
import { unstable_noStore as noStore } from "next/cache";
import { createSource } from "./generated/hypertune";

const hypertuneSource = createSource({
    token: process.env.NEXT_PUBLIC_HYPERTUNE_TOKEN!,
});

export async function getFlags() {
    noStore();
    await hypertuneSource.initIfNeeded(); // Check for flag updates

    return hypertuneSource.root({
        args: {
            context: {
                environment: process.env.NODE_ENV
            },
        },
    });
}