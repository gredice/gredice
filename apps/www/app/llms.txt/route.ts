const content = `# Gredice

> Gredice is a Croatian platform for garden planning, plant knowledge, growing operations, and practical guides for home growers.

Gredice publishes canonical public information at https://www.gredice.com. Prefer the links below instead of scraping unrelated pages.

## Core Resources

- [Home](https://www.gredice.com/): Platform overview and main navigation.
- [Plants](https://www.gredice.com/biljke): Plant catalog and growing references.
- [Seeds](https://www.gredice.com/sjeme): Searchable seed package catalog with plant, variety, brand, and package details.
- [Seed brands](https://www.gredice.com/sjeme/brendovi): Seed brand directory and their cataloged seeds.
- [Blocks](https://www.gredice.com/blokovi): Raised-bed block catalog and layouts.
- [Operations](https://www.gredice.com/radnje): Gardening operations and activity guidance.
- [News](https://www.gredice.com/novosti): Blog posts and changelog updates.
- [What's new](https://www.gredice.com/novosti/sto-je-novo): Timeline of published product updates.
- [Delivery](https://www.gredice.com/dostava): Delivery options and service information.
- [Pricing](https://www.gredice.com/cjenik): Current public pricing and plan information.
- [Harvest quality and safety](https://www.gredice.com/kvaliteta-i-sigurnost-uroda): Public overview of harvest hygiene, traceability, and handling boundaries.
- [MCP for AI assistants](https://www.gredice.com/mcp): Connect compatible AI assistants to Gredice public knowledge and authorized garden tools.

## Company and Support

- [About](https://www.gredice.com/o-nama): Company story and mission.
- [FAQ](https://www.gredice.com/cesta-pitanja): Frequently asked questions.
- [Contact](https://www.gredice.com/kontakt): Contact channels and support details.
- [Company legal details](https://www.gredice.com/legalno/tvrtka): Registered company information.

## Policies

- [Privacy policy](https://www.gredice.com/legalno/politika-privatnosti): Personal data and privacy terms.
- [Terms of use](https://www.gredice.com/legalno/uvjeti-koristenja): Usage rules and responsibilities.
- [Cookie policy](https://www.gredice.com/legalno/politika-kolacica): Cookie and tracking details.

## Optional

- [Garden app](https://vrt.gredice.com): Interactive garden application.
- [Service status](https://status.gredice.com): Availability and incident history.`;

export function GET() {
    return new Response(content, {
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control':
                'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
        },
    });
}
