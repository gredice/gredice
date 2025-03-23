import { notFound } from "next/navigation";

export default async function GardenPage({params}: {params: Promise<{id: string}>}) {
    const { id: gardenId } = await params;
    if (!gardenId) {
        return notFound();
    }

    
}