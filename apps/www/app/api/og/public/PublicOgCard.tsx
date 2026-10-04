import type { PublicOgCardData } from '../../../../lib/seo/publicMetadata';

function titleFontSize(title: string) {
    if (title.length > 72) {
        return 46;
    }
    if (title.length > 48) {
        return 54;
    }

    return 62;
}

function GardenIllustration() {
    return (
        <div
            style={{
                alignItems: 'center',
                background: '#dcebd5',
                border: '2px solid #b8d5b3',
                borderRadius: 36,
                display: 'flex',
                height: 390,
                justifyContent: 'center',
                overflow: 'hidden',
                position: 'relative',
                width: 390,
            }}
        >
            <div
                style={{
                    background: '#9ac36d',
                    borderRadius: 60,
                    height: 280,
                    position: 'absolute',
                    right: -90,
                    top: -100,
                    width: 280,
                }}
            />
            <div
                style={{
                    background: '#4c852f',
                    bottom: 36,
                    height: 118,
                    position: 'absolute',
                    transform: 'skewY(-8deg)',
                    width: 285,
                }}
            />
            <div
                style={{
                    alignItems: 'center',
                    background: '#a96845',
                    border: '16px solid #d39769',
                    bottom: 88,
                    display: 'flex',
                    height: 145,
                    justifyContent: 'space-around',
                    padding: '8px 22px',
                    position: 'absolute',
                    transform: 'skewY(-8deg)',
                    width: 285,
                }}
            >
                {[0, 1, 2].map((index) => (
                    <div
                        key={index}
                        style={{
                            alignItems: 'center',
                            display: 'flex',
                            flexDirection: 'column',
                            transform: 'skewY(8deg)',
                        }}
                    >
                        <div
                            style={{
                                background: '#2e6f40',
                                borderRadius: '90% 10% 90% 10%',
                                height: 34,
                                transform: 'rotate(-35deg)',
                                width: 24,
                            }}
                        />
                        <div
                            style={{
                                background: '#2e6f40',
                                height: 38,
                                width: 7,
                            }}
                        />
                    </div>
                ))}
            </div>
            <div
                style={{
                    background: '#f5b942',
                    border: '12px solid #fff2b9',
                    borderRadius: 999,
                    height: 82,
                    position: 'absolute',
                    right: 34,
                    top: 34,
                    width: 82,
                }}
            />
        </div>
    );
}

export function PublicOgCard({
    title,
    description,
    eyebrow,
    imageUrl,
}: PublicOgCardData) {
    return (
        <div
            style={{
                background: '#fefaf6',
                color: '#1d3223',
                display: 'flex',
                fontFamily: 'Arial, sans-serif',
                height: '100%',
                overflow: 'hidden',
                padding: '58px 62px',
                position: 'relative',
                width: '100%',
            }}
        >
            <div
                style={{
                    background: '#e8f1e5',
                    borderRadius: 999,
                    height: 420,
                    left: -210,
                    position: 'absolute',
                    top: -270,
                    width: 620,
                }}
            />
            <div
                style={{
                    alignItems: 'center',
                    color: '#2e6f40',
                    display: 'flex',
                    fontSize: 29,
                    fontWeight: 700,
                    left: 62,
                    letterSpacing: '-0.02em',
                    position: 'absolute',
                    top: 58,
                }}
            >
                <span
                    style={{
                        alignItems: 'center',
                        background: '#2e6f40',
                        borderRadius: 10,
                        color: '#fefaf6',
                        display: 'flex',
                        fontSize: 24,
                        height: 42,
                        justifyContent: 'center',
                        marginRight: 14,
                        width: 42,
                    }}
                >
                    G
                </span>
                Gredice
            </div>

            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    left: 62,
                    position: 'absolute',
                    top: 210,
                    width: 650,
                }}
            >
                {eyebrow ? (
                    <div
                        style={{
                            color: '#4c852f',
                            display: 'flex',
                            fontSize: 20,
                            fontWeight: 700,
                            letterSpacing: '0.08em',
                            marginBottom: 16,
                            textTransform: 'uppercase',
                        }}
                    >
                        {eyebrow}
                    </div>
                ) : null}
                <div
                    style={{
                        display: 'flex',
                        fontSize: titleFontSize(title),
                        fontWeight: 800,
                        letterSpacing: '-0.045em',
                        lineHeight: 1.03,
                        marginBottom: 22,
                    }}
                >
                    {title}
                </div>
                <div
                    style={{
                        color: '#46604d',
                        display: 'flex',
                        fontSize: 24,
                        lineHeight: 1.35,
                        maxWidth: 650,
                    }}
                >
                    {description}
                </div>
            </div>

            <div
                style={{
                    bottom: 58,
                    color: '#66806d',
                    display: 'flex',
                    fontSize: 19,
                    fontWeight: 600,
                    left: 62,
                    position: 'absolute',
                }}
            >
                www.gredice.com
            </div>

            <div
                style={{
                    alignItems: 'center',
                    display: 'flex',
                    height: 390,
                    justifyContent: 'center',
                    position: 'absolute',
                    right: 62,
                    top: 120,
                    width: 390,
                }}
            >
                {imageUrl ? (
                    <div
                        style={{
                            alignItems: 'center',
                            background: '#e8f1e5',
                            border: '2px solid #c9ddc5',
                            borderRadius: 36,
                            display: 'flex',
                            height: 390,
                            justifyContent: 'center',
                            overflow: 'hidden',
                            padding: 18,
                            width: 390,
                        }}
                    >
                        {/* biome-ignore lint/performance/noImgElement: ImageResponse renders native image elements. */}
                        <img
                            alt=""
                            height="354"
                            src={imageUrl}
                            style={{
                                borderRadius: 24,
                                height: '100%',
                                objectFit: 'contain',
                                width: '100%',
                            }}
                            width="354"
                        />
                    </div>
                ) : (
                    <GardenIllustration />
                )}
            </div>
        </div>
    );
}
