'use client';

import { Add } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { Checkbox } from '@signalco/ui-primitives/Checkbox';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { Input } from '@signalco/ui-primitives/Input';
import { Modal } from '@signalco/ui-primitives/Modal';
import { SelectItems } from '@signalco/ui-primitives/SelectItems';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useActionState, useEffect, useMemo, useRef, useState } from 'react';
import { getAccountData } from '../../app/(actions)/accountDataActions';
import { createNotificationAction } from '../../app/(actions)/notificationActions';
import { SelectRaisedBed } from '../../app/admin/raised-beds/[raisedBedId]/SelectRaisedBed';
import { KnownPages } from '../../src/KnownPages';

type TargetMode = 'all' | 'selected' | 'single';

type AccountOption = {
    id: string;
    label: string;
    description?: string;
};

type NotificationTemplate = {
    value: string;
    label: string;
    header: string;
    content: string;
    iconUrl?: string;
    imageUrl?: string;
    linkUrl?: string;
};

type NotificationCreateModalProps = {
    accountId?: string;
    accounts: AccountOption[];
};

export function NotificationCreateModal({
    accountId,
    accounts,
}: NotificationCreateModalProps) {
    const [state, formAction, pending] = useActionState(
        createNotificationAction,
        null,
    );
    const formRef = useRef<HTMLFormElement>(null);
    const [selectedTemplate, setSelectedTemplate] = useState<string>('custom');
    const [target, setTarget] = useState<TargetMode>(
        accountId ? 'single' : 'all',
    );
    const [header, setHeader] = useState('');
    const [content, setContent] = useState('');
    const [iconUrl, setIconUrl] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [linkUrl, setLinkUrl] = useState('');
    const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
        accountId || null,
    );
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [selectedGardenId, setSelectedGardenId] = useState<number | null>(
        null,
    );
    const [selectedRaisedBedId, setSelectedRaisedBedId] = useState<
        string | null
    >(null);
    const [blockId, setBlockId] = useState('');
    const [timestamp, setTimestamp] = useState('');
    const [accountGardens, setAccountGardens] = useState<
        Array<{ id: number; name: string }>
    >([]);
    const [accountUsers, setAccountUsers] = useState<
        Array<{ id: string; userName: string }>
    >([]);

    // Load account users and gardens when account changes
    useEffect(() => {
        const effectiveAccountId =
            target === 'single' ? selectedAccountId : null;

        if (effectiveAccountId) {
            getAccountData(effectiveAccountId)
                .then((data) => {
                    setAccountUsers(data.users);
                    setAccountGardens(data.gardens);
                })
                .catch(() => {
                    setAccountUsers([]);
                    setAccountGardens([]);
                });
        } else {
            setAccountUsers([]);
            setAccountGardens([]);
            setSelectedUserId(null);
            setSelectedGardenId(null);
            setSelectedRaisedBedId(null);
        }
    }, [selectedAccountId, target]);

    // Reset garden/raised bed when account changes
    useEffect(() => {
        setSelectedGardenId(null);
        setSelectedRaisedBedId(null);
    }, []);

    // Reset raised bed when garden changes
    useEffect(() => {
        setSelectedRaisedBedId(null);
    }, []);

    const templates = useMemo<NotificationTemplate[]>(
        () => [
            {
                value: 'custom',
                label: 'Prilagođena obavijest',
                header: '',
                content: '',
            },
            {
                value: 'new-operation',
                label: 'Dostupna nova radnja',
                header: 'Dostupna nova radnja',
                content: '',
                iconUrl: undefined,
                imageUrl: undefined,
                linkUrl: KnownPages.GrediceOperations,
            },
        ],
        [],
    );

    const templateOptions = useMemo(
        () => templates.map((t) => ({ value: t.value, label: t.label })),
        [templates],
    );

    const targetOptions = useMemo(
        () => [
            { value: 'single' as const, label: 'Jedan račun' },
            { value: 'all' as const, label: 'Svi korisnički računi' },
            { value: 'selected' as const, label: 'Odabrani računi' },
        ],
        [],
    );

    const accountOptions = useMemo(
        () => accounts.map((acc) => ({ value: acc.id, label: acc.label })),
        [accounts],
    );

    const userOptions = useMemo(
        () => [
            { value: '-', label: 'Nije odabrano' },
            ...accountUsers.map((user) => ({
                value: user.id,
                label: user.userName,
            })),
        ],
        [accountUsers],
    );

    const gardenOptions = useMemo(
        () => [
            { value: '-', label: 'Nije odabrano' },
            ...accountGardens.map((garden) => ({
                value: garden.id.toString(),
                label: garden.name,
            })),
        ],
        [accountGardens],
    );

    const handleTemplateChange = (templateValue: string) => {
        setSelectedTemplate(templateValue);
        const template = templates.find((t) => t.value === templateValue);
        if (template) {
            setHeader(template.header);
            setContent(template.content);
            setIconUrl(template.iconUrl || '');
            setImageUrl(template.imageUrl || '');
            setLinkUrl(template.linkUrl || '');
        }
    };

    return (
        <Modal
            trigger={
                <IconButton title="Nova obavijest">
                    <Add className="size-5" />
                </IconButton>
            }
            title={'Nova obavijest'}
        >
            <Stack spacing={4}>
                <Typography level="h5">Nova obavijest</Typography>
                <form ref={formRef} action={formAction} className="space-y-4">
                    <Stack spacing={2}>
                        <SelectItems
                            label="Predložak"
                            value={selectedTemplate}
                            onValueChange={handleTemplateChange}
                            items={templateOptions}
                        />

                        <SelectItems
                            label="Odredište"
                            value={target}
                            onValueChange={(value) =>
                                setTarget(value as TargetMode)
                            }
                            items={targetOptions}
                            required
                        />

                        {/* Single account selection */}
                        {target === 'single' && (
                            <>
                                <SelectItems
                                    label="Račun"
                                    value={selectedAccountId || '-'}
                                    onValueChange={(value) =>
                                        setSelectedAccountId(
                                            value === '-' ? null : value,
                                        )
                                    }
                                    items={[
                                        {
                                            value: '-',
                                            label: 'Odaberite račun...',
                                        },
                                        ...accountOptions,
                                    ]}
                                    required
                                />
                                <input
                                    type="hidden"
                                    name="accountId"
                                    value={selectedAccountId || ''}
                                />

                                {selectedAccountId &&
                                    userOptions.length > 1 && (
                                        <>
                                            <SelectItems
                                                label="Korisnik (opcionalno)"
                                                value={selectedUserId || '-'}
                                                onValueChange={(value) =>
                                                    setSelectedUserId(
                                                        value === '-'
                                                            ? null
                                                            : value,
                                                    )
                                                }
                                                items={userOptions}
                                                disabled={pending}
                                            />
                                            <input
                                                type="hidden"
                                                name="userId"
                                                value={selectedUserId || ''}
                                            />
                                        </>
                                    )}

                                {selectedAccountId &&
                                    gardenOptions.length > 1 && (
                                        <>
                                            <SelectItems
                                                label="Vrt (opcionalno)"
                                                value={
                                                    selectedGardenId?.toString() ||
                                                    '-'
                                                }
                                                onValueChange={(value) =>
                                                    setSelectedGardenId(
                                                        value === '-'
                                                            ? null
                                                            : Number(value),
                                                    )
                                                }
                                                items={gardenOptions}
                                                disabled={pending}
                                            />
                                            <input
                                                type="hidden"
                                                name="gardenId"
                                                value={selectedGardenId || ''}
                                            />
                                        </>
                                    )}

                                {selectedAccountId && selectedGardenId && (
                                    <>
                                        <SelectRaisedBed
                                            label="Gredica (opcionalno)"
                                            value={selectedRaisedBedId}
                                            onChange={setSelectedRaisedBedId}
                                            accountId={selectedAccountId}
                                            gardenId={selectedGardenId}
                                            name="raisedBedId"
                                            disabled={pending}
                                        />

                                        <Input
                                            name="blockId"
                                            label="Blok ID (opcionalno)"
                                            disabled={pending}
                                            value={blockId}
                                            onChange={(e) =>
                                                setBlockId(e.target.value)
                                            }
                                        />
                                    </>
                                )}
                            </>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <Input
                                name="header"
                                label="Naslov"
                                required
                                disabled={pending}
                                className="col-span-2"
                                value={header}
                                onChange={(e) => setHeader(e.target.value)}
                            />
                            <Input
                                name="content"
                                label="Sadržaj"
                                required
                                disabled={pending}
                                className="col-span-2"
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                            />
                            <Input
                                name="iconUrl"
                                label="URL ikone (opcionalno)"
                                disabled={pending}
                                value={iconUrl}
                                onChange={(e) => setIconUrl(e.target.value)}
                            />
                            <Input
                                name="imageUrl"
                                label="URL slike (opcionalno)"
                                disabled={pending}
                                value={imageUrl}
                                onChange={(e) => setImageUrl(e.target.value)}
                            />
                            <Input
                                name="linkUrl"
                                label="Link (opcionalno)"
                                disabled={pending}
                                value={linkUrl}
                                onChange={(e) => setLinkUrl(e.target.value)}
                            />
                            <Input
                                name="timestamp"
                                type="datetime-local"
                                label="Datum obavijesti (opcionalno)"
                                disabled={pending}
                                value={timestamp}
                                onChange={(e) => setTimestamp(e.target.value)}
                                className="col-span-2"
                            />
                        </div>

                        {target === 'selected' && (
                            <Stack spacing={1}>
                                <Typography level="h5" semiBold>
                                    Odaberite račune
                                </Typography>
                                <div className="max-h-72 overflow-y-auto rounded-lg border border-stroke p-3 space-y-2">
                                    {accounts.map((account) => {
                                        const inputId = `account-${account.id}`;

                                        return (
                                            <div
                                                key={account.id}
                                                className="flex items-start gap-3 text-sm"
                                            >
                                                <Checkbox
                                                    id={inputId}
                                                    name="accountIds"
                                                    value={account.id}
                                                    disabled={pending}
                                                    className="mt-1"
                                                />
                                                <label
                                                    htmlFor={inputId}
                                                    className="cursor-pointer"
                                                >
                                                    <Typography
                                                        level="h5"
                                                        semiBold
                                                    >
                                                        {account.label}
                                                    </Typography>
                                                    <Typography level="body2">
                                                        {account.description ||
                                                            account.id}
                                                    </Typography>
                                                </label>
                                            </div>
                                        );
                                    })}
                                    {accounts.length === 0 && (
                                        <Typography level="body2">
                                            Nema dostupnih računa.
                                        </Typography>
                                    )}
                                </div>
                            </Stack>
                        )}

                        <Button
                            type="submit"
                            loading={pending}
                            disabled={pending}
                        >
                            Pošalji
                        </Button>
                    </Stack>
                    {state?.success && (
                        <Typography level="body2" color="success">
                            Obavijest uspješno poslana!
                        </Typography>
                    )}
                </form>
            </Stack>
        </Modal>
    );
}
