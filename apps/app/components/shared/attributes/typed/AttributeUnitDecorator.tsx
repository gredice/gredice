export function attributeUnitDecorator(unit?: string | null) {
    if (!unit) {
        return null;
    }

    return <span className="pr-2 text-sm text-muted-foreground">{unit}</span>;
}
