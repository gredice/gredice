export function GET() {
    return new Response(
        'Povratak u aplikaciju nije uspio. Otvorite Gredice Dostava i pokušajte ponovno.',
        {
            status: 400,
            headers: {
                'Cache-Control': 'no-store',
                'Content-Type': 'text/plain; charset=utf-8',
                Pragma: 'no-cache',
                'Referrer-Policy': 'no-referrer',
            },
        },
    );
}
