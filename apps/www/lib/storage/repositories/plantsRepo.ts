import { and, eq } from 'drizzle-orm';
import { storage } from '../';
import { attributeValues, plants } from '../schema';

export type PlantAttributes = {
    light: number
    water: string
    soil: string
    nutrients: string
    seedingDistance: number
    seedingDepth: number
};

export type PlantCalendarEntry = {
    name: string
    start: number
    end: number
};

export type PlantInstruction = {
    id: number
    action: string
    icon: React.ReactNode
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
        description?: string,
        origin?: string,
        latinName?: string,
        tips?: { header: string, content: string }[]
    },
    images: { url: string }[],
    attributes?: PlantAttributes,
    calendar?: PlantCalendarEntry[],
    instructions?: PlantInstruction[],
    // companions?: number[],
    // antagonists?: number[],
    // diseases?: number[],
    // pests?: number[],
};

type PlantInfo = {
    id: number
    name: string
};

export function getPlants(): Promise<PlantInfo[]> {
    return storage
        .select({
            id: plants.id,
            name: plants.name
        })
        .from(plants);
}

export async function getPlant(id: number): Promise<PlantData | null> {
    const plantPromise = storage.query.plants.findFirst({
        where: eq(plants.id, id)
    });
    const attributesPromise = storage.query.attributeValues.findMany({
        where: and(eq(attributeValues.entityType, "plant"), eq(attributeValues.entityId, id)),
        with: {
            definition: true
        }
    });
    const [plant, attributes] = await Promise.all([plantPromise, attributesPromise]);

    // Extract attributes
    const verified = attributes.some(a => a.definition.category === "information" && a.definition.name === "verified" && a.value?.toLowerCase() === "true");
    const images = attributes.filter(a => a.definition.category === "image");
    const information = attributes.filter(a => a.definition.category === "information");
    const plantAttributes = attributes.filter(a => a.definition.category === "attributes");
    const calendar = attributes.filter(a => a.definition.category === "calendar");

    return {
        ...plant,
        verified,
        images: images.map(i => {
            const imageMetadata = JSON.parse(i.value);
            return ({
                url: imageMetadata.url,
            });
        }),
        information: {
            description: information.find(i => i.definition.name === "description")?.value,
            origin: information.find(i => i.definition.name === "origin")?.value,
            latinName: information.find(i => i.definition.name === "latinName")?.value,
            tips: information.filter(i => i.definition.name === 'tip').map(t => {
                const tipMetadata = JSON.parse(t.value);
                return ({
                    header: tipMetadata.header,
                    content: tipMetadata.content,
                });
            }),
        },
        calendar: calendar.map(c => {
            const calendarMetadata = JSON.parse(c.value);
            const metadataStart = calendarMetadata.start;
            const metadataEnd = calendarMetadata.end;
            const start = typeof metadataStart === "number"
                ? metadataStart
                : 0;
            const end = typeof metadataEnd === "number"
                ? metadataEnd
                : 12;

            return ({
                name: c.definition.name,
                start,
                end,
            });
        }),
        attributes: {
            light: parseFloat(plantAttributes.find(a => a.definition.name === "light")?.value),
            water: plantAttributes.find(a => a.definition.name === "water")?.value,
            soil: plantAttributes.find(a => a.definition.name === "soil")?.value,
            nutrients: plantAttributes.find(a => a.definition.name === "nutrients")?.value,
            seedingDistance: parseFloat(plantAttributes.find(a => a.definition.name === "seedingDistance")?.value),
            seedingDepth: parseFloat(plantAttributes.find(a => a.definition.name === "seedingDepth")?.value),
        }
    };
}