'use server';

import { auth } from "../../lib/auth/auth";
import { createEntityType } from "./entityActions";

export async function submitCreateForm(formData: FormData) {
    await auth(['admin']);

    const name = formData.get('name') as string;
    const label = formData.get('label') as string;

    await createEntityType(name, label);
}