/**
 * Displays a legend explaining the meaning of L-system symbols
 */
export function LSystemLegend() {
    return (
        <div className="p-3 border rounded-md text-xs space-y-1 bg-background/50">
            <h4 className="font-bold mb-2">Legend</h4>
            <p>
                <strong className="font-mono">F, S, druga slova</strong>:
                Stabiljka
            </p>
            <p>
                <strong className="font-mono">L, P, T</strong>: List / Cvijet /
                Plod / Trn
            </p>
            <p>
                <strong className="font-mono">[,]</strong>: Grananje
            </p>
            <p>
                <strong className="font-mono">+, -</strong>: Okret lijevo /
                desno
            </p>
            <p>
                <strong className="font-mono">^, &</strong>: Okret gore / dolje
            </p>
            <p>
                <strong className="font-mono">\, /</strong>: Okret lijevo /
                desno
            </p>
            <p>
                <strong className="font-mono">(a,b)</strong>: Opcionalni
                numericki parametri po simbolu
            </p>
            <p>
                <strong className="font-mono">Lijevo / Desno</strong>:
                Kontekstualna pravila prema susjednim simbolima
            </p>
        </div>
    );
}
