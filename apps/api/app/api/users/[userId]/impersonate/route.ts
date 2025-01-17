import { setCookie, withAuth, createJwt } from "../../../../../lib/auth/auth";

export async function POST(_request: Request, { params }: { params: Promise<{ userId: string }> }) {
    const { userId } = await params;
    if (!userId) {
        return new Response(null, { status: 400 });
    }

    return await withAuth(['admin'], async () => {
        await setCookie(createJwt(userId));
        return new Response(null, { status: 201 });
    });
}