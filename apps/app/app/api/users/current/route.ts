import { getUser } from "@gredice/storage";
import { withAuth } from "../../../../lib/auth/auth";

export async function GET() {
    return await withAuth(async (user) => {
        const dbUser = await getUser(user.userId);

        return new Response(JSON.stringify(dbUser), { status: 200 });
    });
}