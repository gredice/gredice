import { Logotype } from '@gredice/ui/PublicChrome';
import type { ChangelogWeek } from '../lib/weeklyChangelog';

const backgroundColor = '#F4F7ED';
const brandGreen = '#2E6F40';
const foregroundBrown = '#4A3326';
const mutedGreen = '#58705D';
const panelBorder = '#DDE6D7';
const paleSage = '#DCEAD8';

function changeCountLabel(count: number) {
    return count === 1
        ? '1 promjena'
        : count >= 2 && count <= 4
          ? `${count.toString()} promjene`
          : `${count.toString()} promjena`;
}

export function WeeklyChangelogOgImage({ week }: { week: ChangelogWeek }) {
    const visibleEntries = week.entries.slice(0, 3);
    const remainingCount = week.entries.length - visibleEntries.length;

    return (
        <div
            style={{
                alignItems: 'stretch',
                background: backgroundColor,
                color: foregroundBrown,
                display: 'flex',
                fontFamily: 'Montserrat, Arial, sans-serif',
                height: '100%',
                overflow: 'hidden',
                padding: 54,
                position: 'relative',
                width: '100%',
            }}
        >
            <div
                style={{
                    borderColor: paleSage,
                    borderRadius: 999,
                    borderStyle: 'solid',
                    borderWidth: 72,
                    display: 'flex',
                    height: 720,
                    position: 'absolute',
                    right: -250,
                    top: -390,
                    width: 720,
                }}
            />
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: '10px 28px 10px 6px',
                    position: 'relative',
                    width: 618,
                }}
            >
                <Logotype fill={brandGreen} width={205} />
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 18,
                    }}
                >
                    <div
                        style={{
                            background: brandGreen,
                            display: 'flex',
                            height: 6,
                            width: 82,
                        }}
                    />
                    <div
                        style={{
                            color: mutedGreen,
                            display: 'flex',
                            fontSize: 24,
                            fontWeight: 750,
                            letterSpacing: 1.4,
                        }}
                    >
                        {week.isCurrentWeek ? 'OVAJ TJEDAN' : 'TJEDNI PREGLED'}
                    </div>
                    <div
                        style={{
                            display: 'flex',
                            fontFamily:
                                'Montserrat, Arial Black, Arial, sans-serif',
                            fontSize: week.isCurrentWeek ? 67 : 56,
                            fontWeight: 850,
                            letterSpacing: -1.2,
                            lineHeight: 1.02,
                            maxWidth: 560,
                        }}
                    >
                        {week.isCurrentWeek
                            ? 'Još novosti stiže'
                            : week.rangeLabel}
                    </div>
                    <div
                        style={{
                            color: mutedGreen,
                            display: 'flex',
                            fontSize: 25,
                            fontWeight: 550,
                            lineHeight: 1.35,
                            maxWidth: 540,
                        }}
                    >
                        {week.isCurrentWeek
                            ? 'Tjedan još traje, a pregled se nadopunjuje svakom novom promjenom.'
                            : `${changeCountLabel(week.entries.length)} povezano je u jedan pregled.`}
                    </div>
                </div>
                <div
                    style={{
                        color: mutedGreen,
                        display: 'flex',
                        fontSize: 22,
                        fontWeight: 650,
                    }}
                >
                    www.gredice.com
                </div>
            </div>
            <div
                style={{
                    background: 'rgba(255, 255, 255, 0.94)',
                    borderColor: panelBorder,
                    borderRadius: 34,
                    borderStyle: 'solid',
                    borderWidth: 1,
                    boxShadow: '0 28px 70px rgba(46, 111, 64, 0.15)',
                    display: 'flex',
                    flex: 1,
                    flexDirection: 'column',
                    gap: 18,
                    justifyContent: 'center',
                    padding: 28,
                    position: 'relative',
                }}
            >
                <div
                    style={{
                        color: mutedGreen,
                        display: 'flex',
                        fontSize: 20,
                        fontWeight: 800,
                        letterSpacing: 1,
                    }}
                >
                    {week.entries.length > 0
                        ? week.isCurrentWeek
                            ? 'VEĆ OBJAVLJENO'
                            : 'IZDVOJENE PROMJENE'
                        : 'USKORO U PREGLEDU'}
                </div>
                {visibleEntries.length > 0 ? (
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 13,
                        }}
                    >
                        {visibleEntries.map((entry) => (
                            <div
                                key={entry.id}
                                style={{
                                    alignItems: 'center',
                                    background: '#F8FAF5',
                                    borderColor: panelBorder,
                                    borderRadius: 19,
                                    borderStyle: 'solid',
                                    borderWidth: 1,
                                    display: 'flex',
                                    gap: 16,
                                    minHeight: 112,
                                    overflow: 'hidden',
                                    padding: entry.metaImageUrl
                                        ? '10px 18px 10px 10px'
                                        : '18px',
                                }}
                            >
                                {entry.metaImageUrl ? (
                                    // biome-ignore lint/performance/noImgElement: OG rendering uses published CMS cover URLs.
                                    <img
                                        alt=""
                                        height="90"
                                        src={entry.metaImageUrl}
                                        style={{
                                            borderRadius: 13,
                                            height: 90,
                                            objectFit: 'cover',
                                            width: 132,
                                        }}
                                        width="132"
                                    />
                                ) : (
                                    <div
                                        style={{
                                            alignItems: 'center',
                                            background: paleSage,
                                            borderRadius: 13,
                                            color: brandGreen,
                                            display: 'flex',
                                            fontSize: 34,
                                            fontWeight: 850,
                                            height: 74,
                                            justifyContent: 'center',
                                            width: 74,
                                        }}
                                    >
                                        {entry.title.slice(0, 1)}
                                    </div>
                                )}
                                <div
                                    style={{
                                        display: 'flex',
                                        flex: 1,
                                        fontSize: 23,
                                        fontWeight: 750,
                                        lineHeight: 1.18,
                                    }}
                                >
                                    {entry.title}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div
                        style={{
                            alignItems: 'flex-start',
                            background: '#F8FAF5',
                            borderColor: panelBorder,
                            borderRadius: 24,
                            borderStyle: 'solid',
                            borderWidth: 1,
                            display: 'flex',
                            flex: 1,
                            flexDirection: 'column',
                            justifyContent: 'center',
                            padding: 32,
                        }}
                    >
                        <div
                            style={{
                                color: brandGreen,
                                display: 'flex',
                                fontSize: 41,
                                fontWeight: 850,
                                lineHeight: 1.06,
                            }}
                        >
                            Još novosti stiže
                        </div>
                        <div
                            style={{
                                color: mutedGreen,
                                display: 'flex',
                                fontSize: 24,
                                lineHeight: 1.35,
                                marginTop: 16,
                            }}
                        >
                            Vratite se tijekom tjedna po nove promjene i
                            mogućnosti.
                        </div>
                    </div>
                )}
                <div
                    style={{
                        color: mutedGreen,
                        display: 'flex',
                        fontSize: 19,
                        fontWeight: 650,
                    }}
                >
                    {remainingCount > 0
                        ? `I još ${changeCountLabel(remainingCount)} u tjednom pregledu.`
                        : week.isCurrentWeek
                          ? 'Popis se nadopunjuje tijekom tjedna.'
                          : 'Svaka promjena vodi na cijelu objavu.'}
                </div>
            </div>
        </div>
    );
}
