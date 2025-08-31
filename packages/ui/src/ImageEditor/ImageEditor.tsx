'use client';

import { Button } from '@signalco/ui-primitives/Button';
import { Input } from '@signalco/ui-primitives/Input';
import { Modal } from '@signalco/ui-primitives/Modal';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { useCallback, useEffect, useRef, useState } from 'react';

interface ImageEditorProps {
    file: File;
    onSave: (file: File) => void;
    onCancel: () => void;
}

export function ImageEditor({ file, onSave, onCancel }: ImageEditorProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [imageEl, setImageEl] = useState<HTMLImageElement | null>(null);
    const [crop, setCrop] = useState({ x: 0, y: 0, width: 0, height: 0 });
    const [angle, setAngle] = useState(0);
    const [scale, setScale] = useState(100);
    const [outputSize, setOutputSize] = useState({ width: 0, height: 0 });

    useEffect(() => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.src = url;
        img.onload = () => {
            setImageEl(img);
            setCrop({ x: 0, y: 0, width: img.width, height: img.height });
            setOutputSize({ width: img.width, height: img.height });
        };
        return () => URL.revokeObjectURL(url);
    }, [file]);

    const draw = useCallback(
        (img: HTMLImageElement) => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const scaleFactor = scale / 100;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            canvas.width = Math.round(crop.width * scaleFactor);
            canvas.height = Math.round(crop.height * scaleFactor);
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const tmpCanvas = document.createElement('canvas');
            tmpCanvas.width = img.width;
            tmpCanvas.height = img.height;
            const tctx = tmpCanvas.getContext('2d');
            if (!tctx) return;
            tctx.translate(img.width / 2, img.height / 2);
            tctx.rotate((angle * Math.PI) / 180);
            tctx.drawImage(img, -img.width / 2, -img.height / 2);

            ctx.drawImage(
                tmpCanvas,
                crop.x,
                crop.y,
                crop.width,
                crop.height,
                0,
                0,
                canvas.width,
                canvas.height,
            );
        },
        [angle, crop, scale],
    );

    useEffect(() => {
        if (imageEl) {
            draw(imageEl);
            const scaleFactor = scale / 100;
            setOutputSize({
                width: Math.round(crop.width * scaleFactor),
                height: Math.round(crop.height * scaleFactor),
            });
        }
    }, [imageEl, draw, crop, scale]);

    const handleSave = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.toBlob((blob) => {
            if (blob) {
                const edited = new File([blob], file.name, { type: file.type });
                onSave(edited);
            }
        }, file.type);
    };

    const handleOutputWidthChange = (width: number) => {
        setScale(Math.round((width / crop.width) * 100));
    };

    const handleOutputHeightChange = (height: number) => {
        setScale(Math.round((height / crop.height) * 100));
    };

    function handleOpenChange(newOpen: boolean) {
        if (!newOpen) {
            onCancel();
        }
    }

    return (
        <Modal
            open
            onOpenChange={handleOpenChange}
            title="Uredi sliku"
            className="md:max-w-lg"
        >
            <Stack spacing={3}>
                <canvas ref={canvasRef} className="max-w-full" />
                <Row spacing={2}>
                    <div className="flex flex-col">
                        <span>X</span>
                        <Input
                            type="number"
                            value={crop.x}
                            onChange={(e) =>
                                setCrop({
                                    ...crop,
                                    x: Number(e.target.value) || 0,
                                })
                            }
                        />
                    </div>
                    <div className="flex flex-col">
                        <span>Y</span>
                        <Input
                            type="number"
                            value={crop.y}
                            onChange={(e) =>
                                setCrop({
                                    ...crop,
                                    y: Number(e.target.value) || 0,
                                })
                            }
                        />
                    </div>
                    <div className="flex flex-col">
                        <span>W</span>
                        <Input
                            type="number"
                            value={crop.width}
                            onChange={(e) =>
                                setCrop({
                                    ...crop,
                                    width: Number(e.target.value) || 0,
                                })
                            }
                        />
                    </div>
                    <div className="flex flex-col">
                        <span>H</span>
                        <Input
                            type="number"
                            value={crop.height}
                            onChange={(e) =>
                                setCrop({
                                    ...crop,
                                    height: Number(e.target.value) || 0,
                                })
                            }
                        />
                    </div>
                </Row>
                <Row spacing={2}>
                    <div className="flex flex-col">
                        <span>Rotacija</span>
                        <Input
                            type="number"
                            value={angle}
                            onChange={(e) =>
                                setAngle(Number(e.target.value) || 0)
                            }
                        />
                    </div>
                    <div className="flex flex-col">
                        <span>Skaliranje (%)</span>
                        <Input
                            type="number"
                            value={scale}
                            onChange={(e) =>
                                setScale(Number(e.target.value) || 100)
                            }
                        />
                    </div>
                    <div className="flex flex-col">
                        <span>Širina (px)</span>
                        <Input
                            type="number"
                            value={outputSize.width}
                            onChange={(e) =>
                                handleOutputWidthChange(
                                    Number(e.target.value) || 0,
                                )
                            }
                        />
                    </div>
                    <div className="flex flex-col">
                        <span>Visina (px)</span>
                        <Input
                            type="number"
                            value={outputSize.height}
                            onChange={(e) =>
                                handleOutputHeightChange(
                                    Number(e.target.value) || 0,
                                )
                            }
                        />
                    </div>
                </Row>
                <Row spacing={2} justifyContent="end">
                    <Button variant="outlined" onClick={onCancel}>
                        Odustani
                    </Button>
                    <Button onClick={handleSave}>Spremi</Button>
                </Row>
            </Stack>
        </Modal>
    );
}
