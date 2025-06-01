"use client"

import { Check, LoaderSpinner, Redo, Stop, Tally3, Warning } from "@signalco/ui-icons";
import { Button, type ButtonProps } from "@signalco/ui-primitives/Button"
import { Chip } from "@signalco/ui-primitives/Chip";
import { Modal } from "@signalco/ui-primitives/Modal";
import { Row } from "@signalco/ui-primitives/Row";
import type React from "react"
import { useState, useRef, useEffect, useCallback } from "react"
import { BrowserMultiFormatReader, NotFoundException, ChecksumException, FormatException } from "@zxing/library"

type BarcodeScanButtonProps = {
    onScan?: (barcode: string, format?: string) => void
    onError?: (error: string) => void
} & ButtonProps;

type ScanState = "idle" | "requesting-permission" | "scanning" | "success" | "error"

export function BarcodeScanButton({
    onScan,
    onError,
    disabled,
    children,
    ...rest
}: BarcodeScanButtonProps) {
    const [scanState, setScanState] = useState<ScanState>("idle")
    const [error, setError] = useState("")
    const [isSupported, setIsSupported] = useState(true)
    const [isCameraOpen, setIsCameraOpen] = useState(false)
    const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([])
    const [selectedCameraIndex, setSelectedCameraIndex] = useState<number>(0)
    const [activeCameraLabel, setActiveCameraLabel] = useState<string>("")
    const [lastScannedCode, setLastScannedCode] = useState<string>("")

    const videoRef = useRef<HTMLVideoElement>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null)
    const scanningRef = useRef<boolean>(false)

    // Initialize ZXing code reader
    useEffect(() => {
        codeReaderRef.current = new BrowserMultiFormatReader()

        return () => {
            if (codeReaderRef.current) {
                codeReaderRef.current.reset()
            }
        }
    }, []);

    // Check if camera is supported
    useEffect(() => {
        const checkSupport = async () => {
            const hasCamera = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
            setIsSupported(hasCamera)

            if (hasCamera) {
                try {
                    // Request permission to enumerate devices
                    await navigator.mediaDevices.getUserMedia({ video: true })
                    const cameras = await enumerateCameras()
                    setAvailableCameras(cameras)

                    // Load saved camera preference
                    const savedIndex = loadSavedCameraIndex(cameras.length)
                    setSelectedCameraIndex(savedIndex)

                    if (cameras.length > 0) {
                        const preferredCamera = cameras[savedIndex] || cameras[0]
                        setActiveCameraLabel(getCameraLabel(preferredCamera, savedIndex))
                    }
                } catch (err) {
                    console.error("Failed to get camera list:", err)
                }
            } else {
                setError("Camera not supported on this device")
            }
        }

        checkSupport()
    }, [])

    // Get a user-friendly camera label
    const getCameraLabel = (camera: MediaDeviceInfo, index: number): string => {
        if (camera.label) {
            const label = camera.label.toLowerCase()
            if (label.includes("back")) return "Back Camera"
            if (label.includes("front") || label.includes("facetime")) return "Front Camera"
            return camera.label
        }
        return `Camera ${index + 1}`
    }

    // Enumerate available cameras
    const enumerateCameras = async (): Promise<MediaDeviceInfo[]> => {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices()
            const videoDevices = devices.filter((device) => device.kind === "videoinput")
            return videoDevices
        } catch (err) {
            console.error("Failed to enumerate cameras:", err)
            return []
        }
    }

    // Load saved camera preference from localStorage
    const loadSavedCameraIndex = (maxCameras: number): number => {
        try {
            const saved = localStorage.getItem("barcode-scanner-camera-index")
            if (saved !== null) {
                const index = Number.parseInt(saved, 10)
                return index >= 0 && index < maxCameras ? index : 0
            }
            return 0
        } catch (err) {
            console.error("Failed to load saved camera:", err)
            return 0
        }
    }

    // Save camera preference to localStorage
    const saveCameraIndex = (index: number) => {
        try {
            localStorage.setItem("barcode-scanner-camera-index", index.toString())
        } catch (err) {
            console.error("Failed to save camera preference:", err)
        }
    }

    // Handle successful scan
    const handleScanSuccess = useCallback(
        (code: string, format?: string) => {
            // Prevent duplicate scans
            if (code === lastScannedCode) return

            setLastScannedCode(code)
            setScanState("success")
            setError("")
            onScan?.(code, format)

            // Close camera modal after successful scan
            setIsCameraOpen(false)
            stopCameraScanning()

            // Reset scan state after a delay
            setTimeout(() => {
                setScanState("idle")
                setLastScannedCode("")
            }, 2000)

        },
        [onScan, lastScannedCode],
    )

    // Handle scan error
    const handleScanError = useCallback(
        (errorMsg: string) => {
            setError(errorMsg)
            setScanState("error")
            onError?.(errorMsg)
        },
        [onError],
    )

    // Start camera scanning
    const startCameraScanning = async () => {
        if (!isSupported || !codeReaderRef.current) {
            handleScanError("Camera not supported on this device")
            return
        }

        setScanState("requesting-permission")
        setError("")
        scanningRef.current = true

        try {
            let deviceId: string | undefined

            if (availableCameras.length > 0) {
                const camera = availableCameras[selectedCameraIndex]
                deviceId = camera.deviceId
                setActiveCameraLabel(getCameraLabel(camera, selectedCameraIndex))
            }

            if (!deviceId) {
                handleScanError("No camera selected")
                return
            }

            // Start decoding from video device
            await codeReaderRef.current.decodeFromVideoDevice(deviceId, videoRef.current!, (result, error) => {
                if (!scanningRef.current) return

                if (result) {
                    // Successfully decoded a barcode
                    const text = result.getText()
                    const format = result.getBarcodeFormat()?.toString()
                    handleScanSuccess(text, format)
                } else if (error) {
                    // Handle specific ZXing errors
                    if (error instanceof NotFoundException) {
                        // No barcode found - this is normal, continue scanning
                        return
                    } else if (error instanceof ChecksumException) {
                        console.warn("Barcode checksum error:", error)
                    } else if (error instanceof FormatException) {
                        console.warn("Barcode format error:", error)
                    } else {
                        console.warn("Barcode scanning error:", error)
                    }
                }
            })

            setScanState("scanning")
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : "Failed to access camera"
            handleScanError(`Camera access denied: ${errorMsg}`)
            scanningRef.current = false
        }
    }

    // Stop camera scanning
    const stopCameraScanning = () => {
        scanningRef.current = false

        if (codeReaderRef.current) {
            codeReaderRef.current.reset()
        }

        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop())
            streamRef.current = null
        }

        setScanState("idle")
    }

    // Toggle to next camera
    const toggleCamera = async () => {
        if (availableCameras.length <= 1) return

        const nextIndex = (selectedCameraIndex + 1) % availableCameras.length
        setSelectedCameraIndex(nextIndex)
        saveCameraIndex(nextIndex)

        // Update active camera label
        const nextCamera = availableCameras[nextIndex]
        setActiveCameraLabel(getCameraLabel(nextCamera, nextIndex))

        // If currently scanning, restart with new camera
        if (scanState === "scanning") {
            stopCameraScanning()
            setTimeout(() => {
                startCameraScanning()
            }, 100)
        }
    }

    // Open camera modal
    const openCamera = () => {
        setIsCameraOpen(true)
        setLastScannedCode("") // Reset last scanned code
        // Start camera when modal opens
        setTimeout(() => {
            startCameraScanning()
        }, 300) // Small delay to ensure modal is rendered
    }

    // Close camera modal
    const closeCamera = () => {
        stopCameraScanning()
        setIsCameraOpen(false)
    }

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopCameraScanning()
        }
    }, [])

    return (
        <>
            {/* Scan Button */}
            <Button
                {...rest}
                onClick={openCamera}
                disabled={disabled || !isSupported}
            >
                {children || (
                    <Tally3 className="size-4" />
                )}
            </Button>

            {/* Camera Modal */}
            <Modal
                title="Barcode"
                open={isCameraOpen}
                onOpenChange={(open) => {
                    if (!open) closeCamera()
                    else setIsCameraOpen(true)
                }}
            >
                <Row className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        Scan Barcode
                    </div>

                    {/* Camera Toggle Button - Only show if multiple cameras */}
                    {availableCameras.length > 1 && scanState === "scanning" && (
                        <Button
                            variant="outlined"
                            onClick={toggleCamera}
                            className="size-8"
                            aria-label="Odabir kamere"
                        >
                            <Redo className="size-4" />
                        </Button>
                    )}
                </Row>

                <div className="space-y-4">
                    {/* Error Message */}
                    {error && scanState === "error" && (
                        <div className="bg-red-50 text-red-700 p-2 rounded-md text-sm flex items-center gap-2">
                            <Warning className="size-4" />
                            {error}
                        </div>
                    )}

                    {/* Active Camera Indicator */}
                    {activeCameraLabel && (
                        <div className="flex justify-center">
                            <Chip color={scanState === "scanning" ? 'error' : 'neutral'}>
                                {activeCameraLabel}
                            </Chip>
                        </div>
                    )}

                    {/* Camera Video Feed */}
                    <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden">
                        <video
                            ref={videoRef}
                            className="w-full h-full object-cover"
                            playsInline
                            muted
                            aria-label="Camera feed for barcode scanning"
                        />

                        {/* Scanning Overlay */}
                        {scanState === "scanning" && (
                            <div className="border-2 border-white border-dashed w-48 h-32 rounded-lg animate-pulse">
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-1 h-full bg-red-500 opacity-50 animate-pulse" />
                                </div>
                            </div>
                        )}

                        {/* Placeholder when camera is off */}
                        {scanState === "idle" && (
                            <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
                                <div className="text-center text-gray-500">
                                    <p>Odabrana kamera će biti prikazana ovdje</p>
                                </div>
                            </div>
                        )}

                        {/* Permission requesting state */}
                        {scanState === "requesting-permission" && (
                            <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
                                <div className="text-center text-gray-500">
                                    <LoaderSpinner className="size-6 animate-spin mb-2" />
                                    <p>Potrebna dozvola za korištenje kamere...</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Status Badge */}
                    <div className="flex justify-center">
                        <Chip
                            color={
                                scanState === "scanning"
                                    ? "neutral"
                                    : scanState === "success"
                                        ? "success"
                                        : scanState === "error"
                                            ? "error"
                                            : "info"
                            }
                            className="flex items-center gap-1"
                        >
                            {scanState === "requesting-permission" && (
                                <>
                                    <LoaderSpinner className="size-6 animate-spin mb-2" />
                                    <p>Potrebna dozvola za korištenje kamere...</p>
                                </>
                            )}
                            {scanState === "scanning" && (
                                <>
                                    <LoaderSpinner className="w-3 h-3 animate-spin" />
                                    Scanning for barcode...
                                </>
                            )}
                            {scanState === "success" && (
                                <>
                                    <Check className="w-3 h-3" />
                                    Scan successful
                                </>
                            )}
                            {scanState === "error" && (
                                <>
                                    <Warning className="w-3 h-3" />
                                    Scan failed
                                </>
                            )}
                            {scanState === "idle" && "Ready to scan"}
                        </Chip>
                    </div>

                    {/* Camera Controls */}
                    <div className="flex gap-2 justify-center">
                        {scanState === "scanning" && (
                            <Button onClick={stopCameraScanning} size="sm">
                                <Stop className="size-4 mr-2" />
                                Stop Scanning
                            </Button>
                        )}

                        <Button onClick={closeCamera} variant="outlined" size="sm">
                            Cancel
                        </Button>
                    </div>

                    <p className="text-xs text-center text-gray-500">Point your camera at a barcode to scan it automatically</p>
                </div>
            </Modal>
        </>
    )
}
