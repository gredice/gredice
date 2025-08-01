'use server';

import { revalidatePath } from "next/cache";

export async function invalidatePage() {
    revalidatePath('/');
}