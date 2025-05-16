import { client } from "@gredice/client";
import { unstable_cache } from "next/cache";
import { FaqData } from "../../app/cesta-pitanja/@types/FaqData";

export const getFaqData = unstable_cache(async () => {
    return await (await client().api.directories.entities[":entityType"].$get({
        param: {
            entityType: "faq"
        }
    })).json() as FaqData[];
},
    ['faqData'],
    {
        revalidate: 60 * 60, // 1 hour
        tags: ['faqData']
    });