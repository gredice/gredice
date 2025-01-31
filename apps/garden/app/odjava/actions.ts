'use server';

import { clearCookie } from "../../lib/auth/auth";

export async function signOut() {
    await clearCookie();
}