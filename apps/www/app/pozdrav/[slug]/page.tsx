import { redirect } from "next/navigation";

export default async function HelloPage({ }: { params: Promise<{ slug: string }> }) {
    // const { slug } = await params;
    // TODO: Display custom hello page for provided slug
    redirect('/');
}