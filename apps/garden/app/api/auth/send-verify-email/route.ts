import { getUserWithLogins } from "@gredice/storage";
import { sendEmailVerification } from "../../../../lib/auth/email";

export async function POST(request: Request) {
    const body = await request.json();
    const { email } = body;
    if (!email) {
        return new Response('Email is required', { status: 400 });
    }

    const user = await getUserWithLogins(email);
    if (!user) {
        console.log('User does not exist', email);
        return new Response('User does not exist', { status: 400 });
    }

    // Send email
    await sendEmailVerification(email);

    return new Response(null, { status: 201 });
}