import { setCookie } from '../../../lib/auth/auth';

export async function POST(request: Request) {
    const body = await request.json();
    const { email, password } = body;
    if (!email || !password) {
        return new Response('User name and password are required', {
            status: 400,
        });
    }

    const response = await fetch('https://api.gredice.com/api/auth/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
    });
    const data = await response.json();

    await setCookie(data.token);

    return Response.json(data);
}
