import { createUserWithPassword, getUserWithLogins } from "@gredice/storage";
import { sendEmailVerification } from "../send-verify-email/route";

export async function POST(request: Request) {
    const body = await request.json();
    const { email, password } = body;
    if (!email || !password) {
        return new Response('User name and password are required', { status: 400 });
    }

    const user = await getUserWithLogins(email);
    if (user) {
        console.log('User already exists', email);
        // TODO: Instead, do login flow
        return new Response('User already exists', { status: 400 });
    }

    // Create user with password
    await createUserWithPassword(email, password);

    // TODO: Implement email verification
    await sendEmailVerification(email);

    return new Response(null, { status: 201 });
}
