'use server';

import { createEntityType } from "./entityActions";

export async function submitCreateForm(formData: FormData) {
    const name = formData.get('name') as string;
    const label = formData.get('label') as string;

    await createEntityType(name, label);
}