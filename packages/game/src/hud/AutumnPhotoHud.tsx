import {
    autumnPhotoPrompts,
    getAutumnPhotoFilename,
} from '@gredice/js/autumnPhotoPrompts';
import { Button } from '@gredice/ui/Button';
import { IconButton } from '@gredice/ui/IconButton';
import { Camera } from '@gredice/ui/icons';
import { useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createGardenPhotoScene } from '../gardenPhotoScene';
import { resolveExplicitGarden } from '../hooks/gardenSelection';
import {
    currentAccountKeys,
    useCurrentAccount,
} from '../hooks/useCurrentAccount';
import { useCurrentGarden } from '../hooks/useCurrentGarden';
import {
    type GardenAccountGroups,
    gardenAccountGroupsKeys,
} from '../hooks/useGardenAccountGroups';
import { GameModal } from '../shared-ui/game-modal';
import { useGameState, useGameStateStore } from '../useGameState';
import { GardenPhotoRendererLoader } from './GardenPhotoRendererLoader';
import type { GardenPhotoRequest } from './gardenPhotoRequest';

export function AutumnPhotoHud() {
    const [open, setOpen] = useState(false);
    const [promptId, setPromptId] = useState('moja-jesenska-gredica');
    const [request, setRequest] = useState<GardenPhotoRequest | null>(null);
    const [photo, setPhoto] = useState<{
        url: string;
        width: number;
        height: number;
    } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);
    const { data: garden } = useCurrentGarden();
    const localSandbox = useGameState((state) => state.localSandboxStorageKey);
    const authenticated = useGameState(
        (state) => state.authenticatedGardenQueriesEnabled,
    );
    const { data: account } = useCurrentAccount(authenticated && !localSandbox);
    const cameraVersion = useGameState(
        (state) => state.gameCameraSnapshot?.version,
    );
    const freezeTime = useGameState((state) => state.freezeTime);
    const winterMode = useGameState((state) => state.winterMode);
    const dayNightCycleDisabled = useGameState(
        (state) => state.dayNightCycleDisabled,
    );
    const queryClient = useQueryClient();
    const gameStore = useGameStateStore();
    const scope = useRef({
        garden,
        accountId: account?.id,
        cameraVersion,
        freezeTime,
        winterMode,
        dayNightCycleDisabled,
    });
    scope.current = {
        garden,
        accountId: account?.id,
        cameraVersion,
        freezeTime,
        winterMode,
        dayNightCycleDisabled,
    };
    const capturedScope = useRef<typeof scope.current | null>(null);
    const activeKey = useRef<string | null>(null);
    const photoUrl = useRef<string | null>(null);
    const cancel = useCallback(() => {
        activeKey.current = null;
        capturedScope.current = null;
        if (photoUrl.current) URL.revokeObjectURL(photoUrl.current);
        photoUrl.current = null;
        setRequest(null);
        setPhoto(null);
        setSaved(false);
    }, []);
    useEffect(() => {
        const source = capturedScope.current;
        if (
            source &&
            (source.garden !== garden ||
                source.accountId !== account?.id ||
                source.cameraVersion !== cameraVersion ||
                source.freezeTime !== freezeTime ||
                source.winterMode !== winterMode ||
                source.dayNightCycleDisabled !== dayNightCycleDisabled)
        ) {
            cancel();
            setError(null);
        }
    }, [
        garden,
        account?.id,
        cameraVersion,
        freezeTime,
        winterMode,
        dayNightCycleDisabled,
        cancel,
    ]);
    useEffect(
        () => () => {
            activeKey.current = null;
            capturedScope.current = null;
            if (photoUrl.current) URL.revokeObjectURL(photoUrl.current);
            photoUrl.current = null;
        },
        [],
    );
    const stillCurrent = useCallback(() => {
        const source = capturedScope.current;
        const current = scope.current;
        return (
            source &&
            source.garden === current.garden &&
            source.accountId === current.accountId &&
            source.cameraVersion === current.cameraVersion &&
            source.freezeTime === current.freezeTime &&
            source.winterMode === current.winterMode &&
            source.dayNightCycleDisabled === current.dayNightCycleDisabled &&
            queryClient.getQueryData<{ id: string } | null>(currentAccountKeys)
                ?.id === source.accountId
        );
    }, [queryClient]);
    const onCapture = useCallback(
        (blob: Blob) => {
            if (
                !request?.key ||
                activeKey.current !== request.key ||
                !stillCurrent()
            )
                return;
            if (blob.type !== 'image/png' || blob.size < 1) {
                activeKey.current = null;
                setRequest(null);
                setError('Fotografija nije uspjela. Pokušaj ponovno.');
                return;
            }
            photoUrl.current = URL.createObjectURL(blob);
            setPhoto({
                url: photoUrl.current,
                width: request?.width ?? 1,
                height: request?.height ?? 1,
            });
            activeKey.current = null;
            setRequest(null);
        },
        [request?.height, request?.width, request?.key, stillCurrent],
    );
    const onError = useCallback(() => {
        if (
            !request?.key ||
            activeKey.current !== request.key ||
            !stillCurrent()
        )
            return;
        activeKey.current = null;
        setRequest(null);
        setError(
            'Fotografiranje nije uspjelo. Pokušaj ponovno ili odaberi drugi pogled.',
        );
    }, [request?.key, stillCurrent]);
    function capture() {
        cancel();
        setError(null);
        const current = gameStore.getState();
        const camera = current.gameCamera?.getSnapshot();
        const viewport = current.gameCamera
            ?.getDomElement()
            ?.getBoundingClientRect();
        const groups = queryClient.getQueryData<GardenAccountGroups>(
            gardenAccountGroupsKeys,
        );
        const owner = garden ? resolveExplicitGarden(groups, garden.id) : null;
        const currentAccountId = queryClient.getQueryData<{
            id: string;
        } | null>(currentAccountKeys)?.id;
        if (
            !garden ||
            !camera ||
            !viewport ||
            currentAccountId !== account?.id ||
            (!garden.isSandbox &&
                !garden.isPublic &&
                (!owner?.isCurrent || owner.accountId !== currentAccountId))
        ) {
            setError(
                'Odabrani pogled još nije spreman. Pričekaj učitavanje svojeg vrta pa pokušaj ponovno.',
            );
            return;
        }
        try {
            const scene = createGardenPhotoScene(garden, camera, viewport);
            const date = new Date((current.freezeTime ?? new Date()).getTime());
            if (!Number.isFinite(date.getTime()))
                throw new Error('Invalid scene date');
            const key = crypto.randomUUID();
            capturedScope.current = scope.current;
            activeKey.current = key;
            setRequest({
                ...scene,
                key,
                date,
                appBaseUrl: current.appBaseUrl,
                spriteBaseUrl: current.spriteBaseUrl,
                dayNightCycleDisabled: current.dayNightCycleDisabled,
                winterMode: current.winterMode,
            });
        } catch {
            setError(
                'Trenutačni pogled nije moguće fotografirati. Pokušaj ponovno.',
            );
        }
    }
    function save() {
        if (!photo || !stillCurrent()) {
            cancel();
            return;
        }
        try {
            const link = document.createElement('a');
            link.href = photo.url;
            link.download = getAutumnPhotoFilename(promptId);
            document.body.append(link);
            link.click();
            link.remove();
            setSaved(true);
        } catch {
            setError('Spremanje nije uspjelo. Pokušaj ponovno.');
        }
    }
    return (
        <>
            <GameModal
                open={open}
                onOpenChange={(next) => {
                    setOpen(next);
                    if (!next) {
                        cancel();
                        setError(null);
                    }
                }}
                title="Jesenski foto trenuci"
                trigger={
                    <IconButton
                        variant="plain"
                        aria-label="Jesenski foto trenuci"
                        title="Jesenski foto trenuci"
                        className="size-10"
                    >
                        <Camera className="size-5" />
                    </IconButton>
                }
            >
                <div className="min-w-0 space-y-4">
                    <p className="text-sm">
                        Mala inspiracija, bez obveze. Fotografiju možeš spremiti
                        samo na svoj uređaj, bez kupnje ili svakodnevnih
                        prijava. Privatnost vrta ostaje ista.
                    </p>
                    <fieldset className="space-y-2">
                        <legend className="font-medium">
                            Odaberi inspiraciju
                        </legend>
                        {autumnPhotoPrompts.map((prompt) => (
                            <label
                                key={prompt.id}
                                className="flex cursor-pointer items-start gap-3 rounded-lg border p-3"
                            >
                                <input
                                    type="radio"
                                    name="autumn-photo-prompt"
                                    value={prompt.id}
                                    checked={promptId === prompt.id}
                                    onChange={() => {
                                        setPromptId(prompt.id);
                                        setSaved(false);
                                    }}
                                    className="mt-1"
                                />
                                <span>
                                    <span className="block font-medium">
                                        {prompt.title}
                                    </span>
                                    <span className="block text-sm text-muted-foreground">
                                        {prompt.description}
                                    </span>
                                </span>
                            </label>
                        ))}
                    </fieldset>
                    <p className="text-sm text-muted-foreground">
                        Snima se odabrani vrt, pogled kamere i datum u trenutku
                        klika. Pregled je mirna slika bez sučelja, naziva
                        gredica, poruka na natpisima, vremenskih efekata i
                        pokretnih posjetitelja.
                    </p>
                    {error && <p role="alert">{error}</p>}
                    {request ? (
                        <div className="space-y-2">
                            <p role="status">Priprema fotografije…</p>
                            <Button variant="plain" onClick={cancel}>
                                Prekini fotografiranje
                            </Button>
                        </div>
                    ) : (
                        <Button onClick={capture}>
                            {error
                                ? 'Pokušaj ponovno'
                                : photo
                                  ? 'Snimi novi pogled'
                                  : 'Fotografiraj odabrani pogled'}
                        </Button>
                    )}
                    {photo && (
                        <div className="space-y-3">
                            <Image
                                src={photo.url}
                                unoptimized
                                alt="Pregled odabranog vrta bez osobnih oznaka"
                                width={photo.width}
                                height={photo.height}
                                className="h-auto w-full rounded-lg"
                            />
                            <Button onClick={save}>Spremi PNG na uređaj</Button>
                            <p className="text-sm">
                                Ništa se ne učitava niti objavljuje. Pregled
                                nestaje kad zatvoriš prozor ili promijeniš račun
                                ili prizor.
                            </p>
                        </div>
                    )}
                    {saved && (
                        <p role="status">
                            Fotografija je predana pregledniku za spremanje na
                            uređaj.
                        </p>
                    )}
                </div>
            </GameModal>
            {open && request && (
                <GardenPhotoRendererLoader
                    key={request.key}
                    request={request}
                    onCapture={onCapture}
                    onError={onError}
                />
            )}
        </>
    );
}
