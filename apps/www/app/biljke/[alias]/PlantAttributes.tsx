import { Sun, Droplet, Sprout, Leaf, Ruler, ArrowDownToLine } from "lucide-react"
import { AttributeCard } from "../../../components/attributes/DetailCard";

export type PlantAttributes = {
    light?: number | null
    water?: string | null
    soil?: string | null
    nutrients?: string | null
    seedingDistance?: number | null
    seedingDepth?: number | null
};

export function PlantAttributes({ attributes }: { attributes: PlantAttributes | undefined }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <AttributeCard
                icon={<Sun className="w-6 h-6" />}
                header="Svijetlost"
                value={attributes?.light == null || Number.isNaN(attributes?.light) ? '-' : (attributes?.light > 0.3 ? 'Polu-sjena' : (attributes?.light > 0.7 ? 'Sunce' : 'Hlad'))} />
            <AttributeCard icon={<Droplet className="w-6 h-6" />} header="Voda" value={attributes?.water} />
            <AttributeCard icon={<Sprout className="w-6 h-6" />} header="Zemlja" value={attributes?.soil} />
            <AttributeCard icon={<Leaf className="w-6 h-6" />} header="Nutrijenti" value={attributes?.nutrients} />
            <AttributeCard icon={<Ruler className="w-6 h-6" />} header="Razmak sijanja/sadnje" value={`${attributes?.seedingDistance || '-'} cm`} />
            <AttributeCard icon={<ArrowDownToLine className="w-6 h-6" />} header="Dubina sijanja" value={`${attributes?.seedingDepth || '-'} cm`} />
        </div>
    )
}