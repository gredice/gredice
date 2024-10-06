import { and, eq } from 'drizzle-orm';
import { storage } from '../';
import { attributeValues, plants } from '../schema';
import { orderBy } from '@signalco/js';

export type PlantAttributes = {
    light?: number | null
    water?: string | null
    soil?: string | null
    nutrients?: string | null
    seedingDistance?: number | null
    seedingDepth?: number | null
};

export type PlantCalendarEntry = {
    name: string
    start: number
    end: number
};

export type PlantInstruction = {
    id: number
    action: string
    icon: unknown
    frequency?: string
    info: string
    relativeDays: number
};

export type PlantData = {
    id: number,
    verified: boolean,
    name: string,
    // plantFamily?: PlantFamily,
    information: {
        description?: string | null,
        origin?: string | null,
        latinName?: string | null,
        soilPreparation?: string | null,
        sowing?: string | null,
        planting?: string | null,
        flowering?: string | null,
        maintenance?: string | null,
        growth?: string | null,
        harvest?: string | null,
        storage?: string | null,
        watering?: string | null,
        tips?: { header: string, content: string }[] | null
    },
    images: { url: string }[],
    attributes?: PlantAttributes,
    calendar?: PlantCalendarEntry[] | null,
    instructions?: PlantInstruction[] | null,
    // companions?: number[],
    // antagonists?: number[],
    // diseases?: number[],
    // pests?: number[],
};

type PlantInfo = {
    id: number
    name: string,
    imageUrl?: string | null
};

export async function getPlants(): Promise<PlantInfo[]> {
    const allPlantsPromise = storage
        .select({
            id: plants.id
        })
        .from(plants)
        .where(eq(plants.isDeleted, false));
    const allPlantsAttributesPromise = storage.query.attributeValues.findMany({
        where: and(eq(attributeValues.entityType, "plant"), eq(attributeValues.isDeleted, false)),
        with: {
            definition: true
        }
    });
    const [allPlants, allPlantsAttributes] = await Promise.all([allPlantsPromise, allPlantsAttributesPromise]);
    const plantNames = allPlantsAttributes.filter(a => a.definition.category === "information" && a.definition.name === "name");
    const plantImages = allPlantsAttributes.filter(a => a.definition.category === "image");
    return orderBy(allPlants.map(plant => {
        const nameAttributeValueValue = plantNames.find(n => n.entityId === plant.id)?.value;
        const imageAttributeValueValue = plantImages.find(i => i.entityId === plant.id)?.value;
        const imageMetadata = imageAttributeValueValue ? JSON.parse(imageAttributeValueValue) as { url?: string; } : null;

        return ({
            id: plant.id,
            name: nameAttributeValueValue || "Nepoznato",
            imageUrl: imageMetadata?.url
        });
    }), (a, b) => a.name.localeCompare(b.name));
}

export async function getPlantInternal(id: number) {
    if (!id) {
        return null;
    }
    const plantPromise = storage.query.plants.findFirst({
        where: and(eq(plants.id, id), eq(plants.isDeleted, false))
    });
    const attributesPromise = storage.query.attributeValues.findMany({
        where: and(eq(attributeValues.entityType, "plant"), eq(attributeValues.entityId, id), eq(attributeValues.isDeleted, false)),
        with: {
            definition: true
        }
    });
    const [plant, attributes] = await Promise.all([plantPromise, attributesPromise]);
    if (!plant) {
        return null;
    }

    return {
        ...plant,
        attributes
    };
}

export async function getPlant(id: number): Promise<PlantData | null> {
    const plantPromise = storage.query.plants.findFirst({
        where: and(eq(plants.id, id), eq(plants.isDeleted, false))
    });
    const attributesPromise = storage.query.attributeValues.findMany({
        where: and(eq(attributeValues.entityType, "plant"), eq(attributeValues.entityId, id), eq(attributeValues.isDeleted, false)),
        with: {
            definition: true
        }
    });
    const [plant, attributes] = await Promise.all([plantPromise, attributesPromise]);
    if (!plant) {
        return null;
    }

    // Extract attributes
    const name = attributes.find(a => a.definition.category === "information" && a.definition.name === "name")?.value || "Nepoznato";
    const verified = attributes.some(a => a.definition.category === "information" && a.definition.name === "verified" && a.value?.toLowerCase() === "true");
    const images = attributes.filter(a => a.definition.category === "image");
    const information = attributes.filter(a => a.definition.category === "information");
    const informationTips = information.filter(i => i.definition.name === 'tip' && (i.value?.length ?? 0) > 0).map(t => {
        const tipMetadata = t.value ? JSON.parse(t.value) as { header?: string, content?: string } : null;
        return ({
            header: tipMetadata?.header || "",
            content: tipMetadata?.content || "",
        });
    });
    const plantAttributes = attributes.filter(a => a.definition.category === "attributes");
    const calendar = attributes.filter(a => a.definition.category === "calendar");

    return {
        ...plant,
        name,
        verified,
        images: images.map(i => {
            const imageMetadata = i.value ? JSON.parse(i.value) as { url?: string } : null;
            return ({
                url: imageMetadata?.url || "",
            });
        }),
        information: {
            description: information.find(i => i.definition.name === "description")?.value,
            origin: information.find(i => i.definition.name === "origin")?.value,
            latinName: information.find(i => i.definition.name === "latinName")?.value,
            soilPreparation: information.find(i => i.definition.name === "soilPreparation")?.value,
            sowing: information.find(i => i.definition.name === "sowing")?.value,
            planting: information.find(i => i.definition.name === "planting")?.value,
            flowering: information.find(i => i.definition.name === "flowering")?.value,
            maintenance: information.find(i => i.definition.name === "maintenance")?.value,
            growth: information.find(i => i.definition.name === "growth")?.value,
            harvest: information.find(i => i.definition.name === "harvest")?.value,
            storage: information.find(i => i.definition.name === "storage")?.value,
            watering: information.find(i => i.definition.name === "watering")?.value,
            tips: informationTips,
        },
        calendar: calendar.filter(c => (c?.value?.length ?? 0) > 0).map(c => {
            const calendarMetadata = c.value ? JSON.parse(c.value) as { start?: number | string, end?: number | string } : null;
            const start = typeof calendarMetadata?.start === 'string'
                ? parseFloat(calendarMetadata.start)
                : (calendarMetadata?.start || 0);
            const end = typeof calendarMetadata?.end === 'string'
                ? parseFloat(calendarMetadata.end)
                : (calendarMetadata?.end || 0);

            return ({
                name: c.definition.name,
                start,
                end,
            });
        }),
        attributes: {
            light: parseFloat(plantAttributes.find(a => a.definition.name === "light")?.value ?? '0'),
            water: plantAttributes.find(a => a.definition.name === "water")?.value,
            soil: plantAttributes.find(a => a.definition.name === "soil")?.value,
            nutrients: plantAttributes.find(a => a.definition.name === "nutrients")?.value,
            seedingDistance: parseFloat(plantAttributes.find(a => a.definition.name === "seedingDistance")?.value ?? '0'),
            seedingDepth: parseFloat(plantAttributes.find(a => a.definition.name === "seedingDepth")?.value ?? '0'),
        }
    };
}

export async function createPlant(): Promise<number> {
    const result = await storage
        .insert(plants)
        .values({})
        .returning({ id: plants.id });
    return result[0].id;
}

export async function deletePlant(entityId: number): Promise<void> {
    await storage
        .update(plants)
        .set({ isDeleted: true })
        .where(eq(plants.id, entityId));
    console.info('Deleted plant', entityId);
}