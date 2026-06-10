import { Logotype } from '../PublicChrome/Logotype';

export type CmsOgImageKind = 'blog' | 'changelog' | 'page';

export type CmsOgImageProps = {
    imageUrl?: string | null;
    kind?: CmsOgImageKind;
    tags?: string[];
    title: string;
};

export const cmsOgImageSize = {
    width: 1200,
    height: 630,
};

export const cmsOgImageContentType = 'image/png';

const backgroundColor = '#fefaf6';
const brandGreen = '#2E6F40';
const foregroundBrown = '#4A3326';
const mutedBrown = '#826B58';
const softBrown = '#E8DCCF';

function templateLabel(kind: CmsOgImageKind) {
    if (kind === 'blog') {
        return 'Novosti';
    }

    if (kind === 'changelog') {
        return 'Što je novo';
    }

    return 'Gredice';
}

function titleFontSize(title: string) {
    if (title.length > 82) {
        return 48;
    }

    if (title.length > 56) {
        return 56;
    }

    return 66;
}

function visibleTags(tags: string[] | undefined) {
    const normalizedTags = new Map<string, string>();
    for (const tag of tags ?? []) {
        const normalizedTag = tag.trim();
        if (normalizedTag) {
            normalizedTags.set(
                normalizedTag.toLocaleLowerCase('hr-HR'),
                normalizedTag,
            );
        }
    }

    return Array.from(normalizedTags.values()).slice(0, 4);
}

export function CmsOgImage({
    imageUrl,
    kind = 'page',
    tags,
    title,
}: CmsOgImageProps) {
    const normalizedTitle = title.trim() || 'Gredice';
    const normalizedImageUrl = imageUrl?.trim() || null;
    const renderedTags = visibleTags(tags);
    const hasImage = Boolean(normalizedImageUrl);

    return (
        <div
            style={{
                alignItems: 'stretch',
                background: backgroundColor,
                color: foregroundBrown,
                display: 'flex',
                fontFamily: 'Montserrat, Arial, sans-serif',
                height: '100%',
                padding: 54,
                position: 'relative',
                width: '100%',
            }}
        >
            <div
                style={{
                    borderColor: softBrown,
                    borderRadius: 34,
                    borderStyle: 'solid',
                    borderWidth: 1,
                    bottom: 32,
                    display: 'flex',
                    left: 32,
                    position: 'absolute',
                    right: 32,
                    top: 32,
                }}
            />
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: '14px 18px',
                    position: 'relative',
                    width: hasImage ? 666 : '100%',
                    zIndex: 1,
                }}
            >
                <div
                    style={{
                        alignItems: 'center',
                        display: 'flex',
                        gap: 26,
                        justifyContent: 'flex-start',
                    }}
                >
                    <Logotype fill={brandGreen} width={210} />
                </div>
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 30,
                        paddingRight: hasImage ? 14 : 84,
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 16,
                        }}
                    >
                        <div
                            style={{
                                color: mutedBrown,
                                display: 'flex',
                                fontSize: 27,
                                fontWeight: 600,
                                lineHeight: 1,
                            }}
                        >
                            {templateLabel(kind)}
                        </div>
                        <div
                            style={{
                                color: foregroundBrown,
                                display: 'flex',
                                fontFamily:
                                    'Montserrat, Arial Black, Arial, sans-serif',
                                fontSize: titleFontSize(normalizedTitle),
                                fontWeight: 800,
                                letterSpacing: 0,
                                lineHeight: 1.04,
                                maxWidth: hasImage ? 610 : 940,
                            }}
                        >
                            {normalizedTitle}
                        </div>
                    </div>
                    {renderedTags.length > 0 ? (
                        <div
                            style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: 14,
                                maxWidth: hasImage ? 560 : 800,
                            }}
                        >
                            {renderedTags.map((tag) => (
                                <div
                                    key={tag}
                                    style={{
                                        background: 'rgba(255, 255, 255, 0.72)',
                                        borderColor: softBrown,
                                        borderRadius: 999,
                                        borderStyle: 'solid',
                                        borderWidth: 1,
                                        color: mutedBrown,
                                        display: 'flex',
                                        fontSize: 25,
                                        fontWeight: 700,
                                        lineHeight: 1,
                                        padding: '13px 19px',
                                    }}
                                >
                                    {tag}
                                </div>
                            ))}
                        </div>
                    ) : null}
                </div>
                <div
                    style={{
                        color: mutedBrown,
                        display: 'flex',
                        fontSize: 24,
                        fontWeight: 600,
                    }}
                >
                    www.gredice.com
                </div>
            </div>
            {hasImage ? (
                <div
                    style={{
                        borderRadius: 30,
                        display: 'flex',
                        flex: 1,
                        marginLeft: 28,
                        overflow: 'hidden',
                        position: 'relative',
                    }}
                >
                    {/** biome-ignore lint/performance/noImgElement: OG rendering accepts arbitrary CMS image URLs. */}
                    <img
                        alt=""
                        src={normalizedImageUrl ?? undefined}
                        style={{
                            height: '100%',
                            objectFit: 'cover',
                            width: '100%',
                        }}
                    />
                    <div
                        style={{
                            borderColor: '#FFFFFFA6',
                            borderRadius: 30,
                            borderStyle: 'solid',
                            borderWidth: 10,
                            bottom: 0,
                            display: 'flex',
                            left: 0,
                            position: 'absolute',
                            right: 0,
                            top: 0,
                        }}
                    />
                </div>
            ) : null}
        </div>
    );
}
