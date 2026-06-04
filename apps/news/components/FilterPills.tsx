import Link from 'next/link';

export function FilterPills({
    active,
    label,
    param,
    values,
}: {
    active?: string;
    label: string;
    param: 'category' | 'tag';
    values: string[];
}) {
    if (values.length === 0) {
        return null;
    }

    return (
        <div className="grid gap-2">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
                {label}
            </p>
            <div className="flex flex-wrap gap-2">
                <Link
                    className={`rounded-sm border px-3 py-1.5 text-sm font-medium ${
                        active
                            ? 'bg-background text-muted-foreground'
                            : 'bg-primary text-primary-foreground'
                    }`}
                    href="/"
                >
                    Sve
                </Link>
                {values.map((value) => (
                    <Link
                        key={value}
                        className={`rounded-sm border px-3 py-1.5 text-sm font-medium ${
                            active === value
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-background text-muted-foreground hover:text-foreground'
                        }`}
                        href={`/?${param}=${encodeURIComponent(value)}`}
                    >
                        {value}
                    </Link>
                ))}
            </div>
        </div>
    );
}
