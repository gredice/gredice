import "server-only";
import { unstable_noStore as noStore } from "next/cache";
import { createSource } from "./generated/hypertune";
import { getContext } from "./identify";

const hypertuneSource = createSource({
    token: process.env.NEXT_PUBLIC_HYPERTUNE_TOKEN!,
});

export default async function getHypertune() {
    noStore();
    await hypertuneSource.initIfNeeded(); // Check for flag updates
    const context = await getContext();

    return hypertuneSource.root({
        args: {
            context
        },
    });
}