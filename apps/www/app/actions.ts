'use server';

import "server-only";

export const preSeasonNewsletterSubscribe = async (_previousState: unknown, formData: FormData) => {
    const email = formData.get('email') as string;

    // Send the form data to the server
    const response = await fetch('https://connect.mailerlite.com/api/subscribers', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + process.env.MAILERLITE_PRESEASON_API_TOKEN
        },
        body: JSON.stringify({ email, groups: ['135742419471697742'] })
    });
    if (response.status !== 200) {
        console.error('Login failed with status', response.status);
        return { error: true }
    }

    return { success: true };
}