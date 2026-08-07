import { ApiReference } from './ApiReference';

export default async function DirectoriesApiPage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    return (
        <div
            className="[--scalar-custom-header-height:calc(62px+env(safe-area-inset-top,0px))]"
            data-testid="api-reference"
        >
            <ApiReference specUrl={`/api/docs/${slug}`} />
        </div>
    );
}
