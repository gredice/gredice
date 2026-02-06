import { ApiReference } from './ApiReference';

export default async function DirectoriesApiPage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    return (
        <div className="[--scalar-custom-header-height:62px]">
            <ApiReference specUrl={`/api/docs/${slug}`} />
        </div>
    );
}
