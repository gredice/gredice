import { Button } from "@signalco/ui-primitives/Button"
import { SoundSlider } from "./SoundSlider"
import {Dispatch, SetStateAction, useEffect, useState} from "react"
import { Card, CardContent } from "@signalco/ui-primitives/Card"
import { Stack } from "@signalco/ui-primitives/Stack"
import { RotateCcw } from "lucide-react"

const DEFAULT_VOLUMES = {
    master: 50,
    ambient: 50,
    sfx: 100,
    music: 100,
}

export function SoundSettingsCard() {
    const [masterVolume, setMasterVolume] = useState(DEFAULT_VOLUMES.master)
    const [masterMuted, setMasterMuted] = useState(false)
    const [ambientVolume, setAmbientVolume] = useState(DEFAULT_VOLUMES.ambient)
    const [ambientMuted, setAmbientMuted] = useState(false)
    const [sfxVolume, setSfxVolume] = useState(DEFAULT_VOLUMES.sfx)
    const [sfxMuted, setSfxMuted] = useState(false)
    const [musicVolume, setMusicVolume] = useState(DEFAULT_VOLUMES.music)
    const [musicMuted, setMusicMuted] = useState(false)

    const handleMasterVolumeChange = (newVolume: number) => {
        setMasterVolume(newVolume)
        setMasterMuted(newVolume === 0)
    }

    const handleMasterMuteToggle = () => {
        setMasterMuted(!masterMuted)
    }

    const handleSliderMuteToggle = (
        setMutedFunc: Dispatch<SetStateAction<boolean>>
    ) => {
        if (!masterMuted && masterVolume > 0) {
            setMutedFunc((prev) => !prev)
        }
    }

    const handleReset = () => {
        setMasterVolume(DEFAULT_VOLUMES.master)
        setAmbientVolume(DEFAULT_VOLUMES.ambient)
        setSfxVolume(DEFAULT_VOLUMES.sfx)
        setMusicVolume(DEFAULT_VOLUMES.music)
        setMasterMuted(false)
        setAmbientMuted(false)
        setSfxMuted(false)
        setMusicMuted(false)
    }

    useEffect(() => {
        if (masterMuted || masterVolume === 0) {
            setAmbientMuted(true)
            setSfxMuted(true)
            setMusicMuted(true)
        } else {
            setAmbientMuted(false)
            setSfxMuted(false)
            setMusicMuted(false)
        }
    }, [masterMuted, masterVolume])

    return (
        <Card>
            <CardContent className="pt-6">
            <Stack spacing={4}>
                <SoundSlider
                    value={masterVolume}
                    muted={masterMuted}
                    onChange={handleMasterVolumeChange}
                    onMuteToggle={handleMasterMuteToggle}
                    label="Glavno"
                />
                <SoundSlider
                    value={musicVolume}
                    muted={masterMuted || masterVolume === 0 || musicMuted}
                    onChange={setMusicVolume}
                    onMuteToggle={() => handleSliderMuteToggle(setMusicMuted)}
                    label="Muzika"
                />
                <SoundSlider
                    value={sfxVolume}
                    muted={masterMuted || masterVolume === 0 || sfxMuted}
                    onChange={setSfxVolume}
                    onMuteToggle={() => handleSliderMuteToggle(setSfxMuted)}
                    label="Efekti"
                />
                <SoundSlider
                    value={ambientVolume}
                    muted={masterMuted || masterVolume === 0 || ambientMuted}
                    onChange={setAmbientVolume}
                    onMuteToggle={() => handleSliderMuteToggle(setAmbientMuted)}
                    label="Ambientalno"
                />
                <Button
                    onClick={handleReset}
                    variant="outlined"
                    startDecorator={<RotateCcw className="size-4" />}
                    size="sm"
                    className="self-end">
                    Vrati zadani
                </Button>
            </Stack>
            </CardContent>
        </Card>
    )
}