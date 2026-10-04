type RaisedBedLatestPhotoThumbnailProps = {
    alt: string;
    imageUrls: string[];
};

export function RaisedBedLatestPhotoThumbnail({
    alt,
    imageUrls,
}: RaisedBedLatestPhotoThumbnailProps) {
    const previewImageUrls = imageUrls.slice(0, 3);
    if (previewImageUrls.length === 0) {
        return null;
    }

    return (
        <span
            className="relative flex size-9 shrink-0 overflow-hidden rounded-md border border-border bg-muted shadow-sm"
            title={alt}
        >
            {previewImageUrls.map((imageUrl, index) => (
                <span
                    key={imageUrl}
                    className="absolute overflow-hidden rounded-[inherit] border border-white/80 bg-muted"
                    style={{
                        inset: index === 0 ? 0 : `${index * 4}px`,
                        zIndex: previewImageUrls.length - index,
                        transform:
                            index === 0
                                ? undefined
                                : `translate(${index * 3}px, ${index * -2}px) rotate(${index * 4}deg)`,
                    }}
                >
                    {/** biome-ignore lint/performance/noImgElement: Operation photos come from runtime data and can use external blob hosts. */}
                    <img
                        src={imageUrl}
                        alt={index === 0 ? alt : ''}
                        className="size-full object-cover"
                        loading="lazy"
                    />
                </span>
            ))}
        </span>
    );
}
