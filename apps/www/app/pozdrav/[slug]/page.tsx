import { redirect } from "next/navigation";

export default async function HelloPage(props: PageProps<'/pozdrav/[slug]'>) {
    // const { slug } = await params;
    // TODO: Display custom hello page for provided slug
    redirect('/');
}