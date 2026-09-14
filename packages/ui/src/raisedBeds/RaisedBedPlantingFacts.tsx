export function RaisedBedPlantingFacts({
    plantCount,
    selectedSeedingDistanceCm,
    plantsPerAxis,
    spanRows,
    spanColumns,
}: {
    plantCount?: number | null;
    selectedSeedingDistanceCm?: number | null;
    plantsPerAxis?: number | null;
    spanRows?: number | null;
    spanColumns?: number | null;
}) {
    const facts = [
        plantCount != null ? `Broj biljaka: ${plantCount}` : null,
        plantsPerAxis != null
            ? `Raspored: ${plantsPerAxis} × ${plantsPerAxis}`
            : null,
        selectedSeedingDistanceCm != null
            ? `${selectedSeedingDistanceCm} cm`
            : null,
        spanRows != null && spanColumns != null
            ? `Zauzima: ${spanRows} × ${spanColumns} polja`
            : null,
    ].filter(Boolean);
    if (!facts.length) return null;
    return <p className="text-xs text-muted-foreground">{facts.join(' · ')}</p>;
}
