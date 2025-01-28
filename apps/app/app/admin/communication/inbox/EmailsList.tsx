import { Resend } from "resend";

let resend: Resend | null = null;

function getResend() {
    if (!resend) {
        resend = new Resend(process.env.RESEND_API_KEY);
    }
    return resend;
}

export async function EmailsList() {
    const resendClient = getResend();
    // resendClient.emails.

    return (
        <div>
            EmailsList
        </div>
    )
}