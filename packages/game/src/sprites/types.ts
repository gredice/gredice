export type SpriteAtlasGrid = {
    cellSize: number;
    columns: number;
    height: number;
    innerSize: number;
    offsetX: number;
    offsetY: number;
    padding: number;
    rows: number;
    width: number;
};

export type SpriteAtlasAssetPaths = {
    basePath: string;
    manifestUrl: string;
    pngUrl: string;
    webpUrl: string;
};

export type SpriteAtlasSprite = {
    aspect: number;
    cell: {
        column: number;
        height: number;
        row: number;
        width: number;
        x: number;
        y: number;
    };
    frame: {
        height: number;
        x: number;
        y: number;
        width: number;
    };
    page?: number;
    source: string;
};

export type SpriteAtlasPage = {
    atlas: SpriteAtlasGrid;
    index: number;
    spriteCount: number;
};

export type SpriteAtlasManifest = {
    atlas?: SpriteAtlasGrid;
    layout?: {
        atlasSize: number;
        columns: number;
        pageCapacity: number;
        padding: number;
        rows: number;
        version: number;
    };
    pages?: SpriteAtlasPage[];
    sprites: Record<string, SpriteAtlasSprite>;
};
