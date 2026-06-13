import { Accordion } from '@gredice/ui/Accordion';
import { Alert } from '@gredice/ui/Alert';
import { ArchiveIcon } from '@gredice/ui/ArchiveIcon';
import { Avatar } from '@gredice/ui/Avatar';
import { AvatarSelectionMenu } from '@gredice/ui/AvatarSelectionMenu';
import {
    AuthProvider,
    FacebookLoginButton,
    GoogleLoginButton,
    SignInButton,
    SignUpButton,
    UserButton,
} from '@gredice/ui/auth';
import { BackpackIcon } from '@gredice/ui/BackpackIcon';
import { BlockImage } from '@gredice/ui/BlockImage';
import { BlurText } from '@gredice/ui/BlurText';
import { Breadcrumbs } from '@gredice/ui/Breadcrumbs';
import { Button } from '@gredice/ui/Button';
import {
    Card,
    CardActions,
    CardContent,
    CardCover,
    CardHeader,
    CardOverflow,
    CardTitle,
} from '@gredice/ui/Card';
import { Checkbox } from '@gredice/ui/Checkbox';
import { Chip } from '@gredice/ui/Chip';
import { Collapse } from '@gredice/ui/Collapse';
import { Container } from '@gredice/ui/Container';
import { CountingNumber } from '@gredice/ui/CountingNumber';
import {
    CardGrid,
    CtaBand,
    Faq1,
    Feature1,
    Footer1,
    Heading1,
    HtmlBlock,
    MarkdownBlock,
    MediaBlock,
    SectionsView,
    TextBlock,
} from '@gredice/ui/cms';
import { DailySchedule } from '@gredice/ui/DailySchedule';
import { DebugPanel, DebugPanelSection } from '@gredice/ui/DebugControls';
import { Divider } from '@gredice/ui/Divider';
import { DotIndicator } from '@gredice/ui/DotIndicator';
import { EditableInput } from '@gredice/ui/EditableInput';
import { ErrorFallback } from '@gredice/ui/ErrorFallback';
import { ExpandableSearchInput } from '@gredice/ui/ExpandableSearchInput';
import { FilterInput } from '@gredice/ui/FilterInput';
import { Gallery } from '@gredice/ui/Gallery';
import { GentleSlide } from '@gredice/ui/GentleSlide';
import {
    Grid1Icon,
    Grid4Icon,
    Grid9Icon,
    Grid16Icon,
    PlantGridIcon,
} from '@gredice/ui/GridIcons';
import { IconButton } from '@gredice/ui/IconButton';
import { ImageEditor } from '@gredice/ui/ImageEditor';
import { ImageGallery } from '@gredice/ui/ImageGallery';
import { ImageViewer } from '@gredice/ui/ImageViewer';
import { Input } from '@gredice/ui/Input';
import {
    Approved,
    Calendar,
    Check,
    CompanyFacebook,
    CompanyGitHub,
    CompanyReddit,
    CompanyX,
    Dashboard,
    Delete,
    Droplet,
    Edit,
    Filter,
    Home,
    Info,
    Leaf,
    MoreHorizontal,
    Search,
    Settings,
    Sprout,
    Store,
    Truck,
    Upload,
    User,
    Warning,
} from '@gredice/ui/icons';
import { Link } from '@gredice/ui/Link';
import { List, ListHeader, ListItem } from '@gredice/ui/List';
import { LoadingIndicator } from '@gredice/ui/LoadingIndicator';
import { LocalDateTime, TimeRange } from '@gredice/ui/LocalDateTime';
import { Markdown } from '@gredice/ui/Markdown';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuItemFragment,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuSeparator,
    DropdownMenuShortcut,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from '@gredice/ui/Menu';
import { Modal } from '@gredice/ui/Modal';
import { ModalConfirm } from '@gredice/ui/ModalConfirm';
import { PageNav } from '@gredice/ui/Nav';
import { NavigatingButton } from '@gredice/ui/NavigatingButton';
import { NoDataPlaceholder } from '@gredice/ui/NoDataPlaceholder';
import {
    NotificationsContainer,
    showNotification,
} from '@gredice/ui/notifications';
import {
    OperationCategoryIcon,
    OperationImage,
} from '@gredice/ui/OperationImage';
import { PageHeader, PageHeaderSection } from '@gredice/ui/PageHeader';
import { PlantingSeedIcon } from '@gredice/ui/PlantingSeedIcon';
import { Popper } from '@gredice/ui/Popper';
import { Progress } from '@gredice/ui/Progress';
import {
    PlantOrSortImage,
    PlantYieldTooltip,
    SeedTimeInformationBadge,
} from '@gredice/ui/plants';
import { RaisedBedIcon } from '@gredice/ui/RaisedBedIcon';
import { RaisedBedIdentifierIcon } from '@gredice/ui/RaisedBedIdentifierIcon';
import { RaisedBedSimpleIcon } from '@gredice/ui/RaisedBedSimpleIcon';
import { Row } from '@gredice/ui/Row';
import { RaisedBedLabel } from '@gredice/ui/raisedBeds';
import { SegmentedCircularProgress } from '@gredice/ui/SegmentedCircularProgress';
import { SelectItems } from '@gredice/ui/SelectItems';
import { ShovelIcon } from '@gredice/ui/ShovelIcon';
import { Skeleton } from '@gredice/ui/Skeleton';
import { Slider } from '@gredice/ui/Slider';
import { Spinner } from '@gredice/ui/Spinner';
import { SplitView } from '@gredice/ui/SplitView';
import { Stack } from '@gredice/ui/Stack';
import { StyledHtml } from '@gredice/ui/StyledHtml';
import { Switch } from '@gredice/ui/Switch';
import { Table } from '@gredice/ui/Table';
import {
    type FilterOption,
    TableFilter,
    TIME_FILTER_OPTIONS,
} from '@gredice/ui/TableFilter';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@gredice/ui/Tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@gredice/ui/Tooltip';
import { Typography } from '@gredice/ui/Typography';
import { UserAvatar } from '@gredice/ui/UserAvatar';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import Image from 'next/image';
import { useMemo, useState } from 'react';

const sampleImages = [
    {
        src: 'https://cdn.gredice.com/sunflower-sad-500x500.png',
        alt: 'Suncokret',
    },
    {
        src: 'https://cdn.gredice.com/avatars/farmer-male.png',
        alt: 'Farmer',
    },
    {
        src: 'https://cdn.gredice.com/avatars/farmer-female.png',
        alt: 'Farmerka',
    },
];

const cmsMediaPreviewUrl = `data:image/svg+xml,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540">
  <rect width="960" height="540" fill="#f6f0e8"/>
  <rect x="88" y="92" width="784" height="356" rx="32" fill="#ffffff" stroke="#d8cbbb" stroke-width="4"/>
  <rect x="144" y="148" width="420" height="28" rx="14" fill="#3a2a1f"/>
  <rect x="144" y="204" width="560" height="18" rx="9" fill="#8c7665"/>
  <rect x="144" y="244" width="488" height="18" rx="9" fill="#8c7665"/>
  <rect x="144" y="316" width="164" height="54" rx="12" fill="#3a2a1f"/>
  <circle cx="730" cy="224" r="72" fill="#c8e08f"/>
  <circle cx="776" cy="312" r="96" fill="#9fc36f"/>
</svg>
`)}`;

const tableFilters: FilterOption[] = [
    TIME_FILTER_OPTIONS,
    {
        key: 'status',
        label: 'Status',
        activeLabel: null,
        icon: <Filter className="size-4" />,
        options: [
            { value: '', label: 'Svi statusi' },
            { value: 'ready', label: 'Spremno' },
            { value: 'blocked', label: 'Blokirano' },
            { value: 'review', label: 'Provjera' },
        ],
    },
    {
        key: 'owner',
        label: 'Tim',
        icon: <User className="size-4" />,
        options: [
            { value: '', label: 'Svi timovi' },
            { value: 'ops', label: 'Operacije' },
            { value: 'farm', label: 'Farma' },
            { value: 'support', label: 'Podrska' },
        ],
    },
];

const operationRows = [
    {
        bed: 'A1',
        crop: 'Rajcica',
        status: 'Spremno',
        owner: 'Ana',
        dueAt: new Date('2026-05-22T09:30:00+02:00'),
    },
    {
        bed: 'B4',
        crop: 'Paprika',
        status: 'Zalijevanje',
        owner: 'Marko',
        dueAt: new Date('2026-05-22T11:00:00+02:00'),
    },
    {
        bed: 'C2',
        crop: 'Bosiljak',
        status: 'Ceka sadnju',
        owner: 'Petra',
        dueAt: new Date('2026-05-23T08:00:00+02:00'),
    },
];

type GalleryPlant = {
    id: string;
    name: string;
    state: string;
    imageUrl: string;
};

const galleryPlants: GalleryPlant[] = [
    {
        id: 'tomato',
        name: 'Rajcica',
        state: 'Sjetva',
        imageUrl: 'https://cdn.gredice.com/sunflower-sad-500x500.png',
    },
    {
        id: 'basil',
        name: 'Bosiljak',
        state: 'Bilje',
        imageUrl: 'https://cdn.gredice.com/avatars/farmer-female.png',
    },
    {
        id: 'pepper',
        name: 'Paprika',
        state: 'Presadnica',
        imageUrl: 'https://cdn.gredice.com/avatars/farmer-male.png',
    },
];

function ControlledTableFilter() {
    const [currentFilters, setCurrentFilters] = useState<
        Record<string, string>
    >({
        status: 'ready',
    });

    return (
        <TableFilter
            filters={tableFilters}
            currentFilters={currentFilters}
            onClearAll={() => setCurrentFilters({})}
            onFilterChange={(key, value) =>
                setCurrentFilters((current) => {
                    if (!value) {
                        const next = { ...current };
                        delete next[key];
                        return next;
                    }

                    return { ...current, [key]: value };
                })
            }
        />
    );
}

function ControlledSelect() {
    const [value, setValue] = useState('today');

    return (
        <SelectItems
            label="Prikaz rasporeda"
            value={value}
            onValueChange={setValue}
            items={[
                { value: 'today', label: 'Danas', icon: <Calendar /> },
                { value: 'week', label: 'Tjedan', icon: <Dashboard /> },
                {
                    value: 'harvest',
                    label: 'Berba',
                    icon: <Leaf />,
                },
                {
                    value: 'delivery',
                    label: 'Dostava',
                    icon: <Truck />,
                },
                {
                    value: 'settings',
                    label: 'Postavke',
                    icon: <Settings />,
                },
                {
                    value: 'blocked',
                    label: 'Blokirano',
                    icon: <Warning />,
                },
            ]}
            helperText="Helper text can carry validation or context."
        />
    );
}

function ControlledSlider() {
    const [value, setValue] = useState([64]);

    return (
        <Slider
            label={`Popunjenost rute: ${value[0]}%`}
            value={value}
            onValueChange={setValue}
            max={100}
            step={1}
        />
    );
}

function EditableName() {
    const [value, setValue] = useState('Jutarnja berba');

    return <EditableInput value={value} onChange={setValue} />;
}

function ExpandableSearchDemo() {
    const [value, setValue] = useState('');

    return (
        <ExpandableSearchInput
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Pretrazi radnje"
            inputClassName="min-w-64"
        />
    );
}

function AvatarMenuDemo() {
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

    return (
        <AvatarSelectionMenu
            displayName="Gredice Storybook"
            onChange={setAvatarUrl}
            title="Avatar za demo profil"
        >
            <Button
                type="button"
                variant="outlined"
                startDecorator={
                    avatarUrl ? (
                        <Avatar
                            alt="Odabrani avatar"
                            src={avatarUrl}
                            size="sm"
                        />
                    ) : (
                        <Avatar size="sm">GS</Avatar>
                    )
                }
            >
                Odaberi avatar
            </Button>
        </AvatarSelectionMenu>
    );
}

function ImageEditorLauncher() {
    const [open, setOpen] = useState(false);
    const demoFile = useMemo(() => {
        if (typeof File === 'undefined') {
            return null;
        }

        const svg = [
            '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160" viewBox="0 0 240 160">',
            '<rect width="240" height="160" rx="20" fill="#d9f99d"/>',
            '<rect x="48" y="44" width="144" height="72" rx="16" fill="#854d0e"/>',
            '<circle cx="92" cy="80" r="14" fill="#22c55e"/>',
            '<circle cx="122" cy="80" r="14" fill="#16a34a"/>',
            '<circle cx="152" cy="80" r="14" fill="#15803d"/>',
            '</svg>',
        ].join('');

        return new File([svg], 'storybook-garden.svg', {
            type: 'image/svg+xml',
        });
    }, []);

    return (
        <>
            <Button
                disabled={!demoFile}
                onClick={() => setOpen(true)}
                startDecorator={<Edit className="size-4" />}
                type="button"
                variant="outlined"
            >
                Uredi naslovnu sliku
            </Button>
            {open && demoFile ? (
                <ImageEditor
                    file={demoFile}
                    onCancel={() => setOpen(false)}
                    onSave={() => setOpen(false)}
                />
            ) : null}
        </>
    );
}

function PlantGalleryCard({ imageUrl, name, state }: GalleryPlant) {
    return (
        <Card className="overflow-hidden">
            <CardCover>
                <Image
                    alt=""
                    className="h-28 w-full object-cover"
                    height={180}
                    src={imageUrl}
                    width={320}
                />
            </CardCover>
            <CardContent className="pt-32">
                <Stack spacing={2}>
                    <Typography level="body2" semiBold>
                        {name}
                    </Typography>
                    <Chip color="success" size="sm" variant="soft">
                        {state}
                    </Chip>
                </Stack>
            </CardContent>
        </Card>
    );
}

function StatusMenu() {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <IconButton aria-label="Opcije zapisa" variant="outlined">
                    <MoreHorizontal className="size-4" />
                </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Brze akcije</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                    <DropdownMenuItem startDecorator={<Check />}>
                        Oznaci kao gotovo
                        <DropdownMenuShortcut>G</DropdownMenuShortcut>
                    </DropdownMenuItem>
                    <DropdownMenuItem startDecorator={<Upload />}>
                        Dodaj fotografiju
                    </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSub>
                    <DropdownMenuSubTrigger inset>
                        Promijeni status
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                        <DropdownMenuRadioGroup value="ready">
                            <DropdownMenuItemFragment>
                                <DropdownMenuItem>Spremno</DropdownMenuItem>
                                <DropdownMenuItem>U tijeku</DropdownMenuItem>
                            </DropdownMenuItemFragment>
                        </DropdownMenuRadioGroup>
                    </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    startDecorator={<Delete />}
                    className="text-red-700 dark:text-red-300"
                >
                    Arhiviraj
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function MetricCard({
    label,
    value,
    color,
    helper,
}: {
    label: string;
    value: number;
    color: 'success' | 'warning' | 'info';
    helper: string;
}) {
    return (
        <Card>
            <CardHeader>
                <Row justifyContent="space-between">
                    <Typography level="body2" secondary>
                        {label}
                    </Typography>
                    <DotIndicator color={color} />
                </Row>
            </CardHeader>
            <CardContent>
                <Typography level="h3">
                    <CountingNumber number={value} />
                </Typography>
                <Typography level="body3" secondary>
                    {helper}
                </Typography>
            </CardContent>
        </Card>
    );
}

function OperationsDashboardShowcase() {
    return (
        <Container className="py-8" maxWidth="xl">
            <Stack spacing={8}>
                <Breadcrumbs
                    items={[
                        { label: 'Admin', href: '/' },
                        { label: 'Operacije', href: '/' },
                        { label: 'Raspored', href: '/' },
                        { label: 'Danas', href: '/' },
                        { label: 'Berba' },
                    ]}
                />
                <PageHeader
                    header="Operativni pregled"
                    alternativeName="Farm and delivery control room"
                    subHeader="Dense dashboard composed from shared Gredice primitives."
                    headerChildren={
                        <Row className="flex-wrap" spacing={2}>
                            <Chip color="success" startDecorator={<Check />}>
                                18 radnji spremno
                            </Chip>
                            <Chip color="warning" variant="outlined">
                                3 cekaju potvrdu
                            </Chip>
                        </Row>
                    }
                >
                    <Card>
                        <CardHeader>
                            <CardTitle>Dnevni kapacitet</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Progress value={72} />
                        </CardContent>
                    </Card>
                </PageHeader>

                <Alert color="warning" title="Provjeri rutu dostave">
                    Jedan termin je prebacen iz jutarnjeg u popodnevni slot.
                </Alert>

                <div className="grid gap-4 md:grid-cols-3">
                    <MetricCard
                        label="Otvorene radnje"
                        value={42}
                        color="info"
                        helper="U svim aktivnim gredicama"
                    />
                    <MetricCard
                        label="Berbe za danas"
                        value={9}
                        color="success"
                        helper="Spremno za ispis naljepnica"
                    />
                    <MetricCard
                        label="Rizici"
                        value={3}
                        color="warning"
                        helper="Potrebna dodatna provjera"
                    />
                </div>

                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
                    <Card>
                        <CardHeader>
                            <Row
                                className="flex-wrap"
                                justifyContent="space-between"
                                spacing={4}
                            >
                                <Stack spacing={1}>
                                    <CardTitle>Prioritetne radnje</CardTitle>
                                    <Typography level="body3" secondary>
                                        Table, filters, menu, local dates, and
                                        action variants in one dense workflow.
                                    </Typography>
                                </Stack>
                                <Row className="flex-wrap" spacing={2}>
                                    <ExpandableSearchDemo />
                                    <ControlledTableFilter />
                                    <StatusMenu />
                                </Row>
                            </Row>
                        </CardHeader>
                        <CardOverflow className="border-t">
                            <Table>
                                <Table.Header>
                                    <Table.Row>
                                        <Table.Head>Gredica</Table.Head>
                                        <Table.Head>Biljka</Table.Head>
                                        <Table.Head>Status</Table.Head>
                                        <Table.Head>Vlasnik</Table.Head>
                                        <Table.Head>Rok</Table.Head>
                                    </Table.Row>
                                </Table.Header>
                                <Table.Body>
                                    {operationRows.map((row) => (
                                        <Table.Row key={row.bed}>
                                            <Table.Cell>
                                                <Row spacing={2}>
                                                    <RaisedBedIdentifierIcon
                                                        physicalId={row.bed}
                                                    />
                                                    <RaisedBedLabel
                                                        physicalId={row.bed}
                                                    />
                                                </Row>
                                            </Table.Cell>
                                            <Table.Cell>{row.crop}</Table.Cell>
                                            <Table.Cell>
                                                <Chip
                                                    color="success"
                                                    size="sm"
                                                    variant="soft"
                                                >
                                                    {row.status}
                                                </Chip>
                                            </Table.Cell>
                                            <Table.Cell>
                                                <UserAvatar
                                                    displayName={row.owner}
                                                    size="sm"
                                                />
                                            </Table.Cell>
                                            <Table.Cell>
                                                <LocalDateTime>
                                                    {row.dueAt}
                                                </LocalDateTime>
                                            </Table.Cell>
                                        </Table.Row>
                                    ))}
                                </Table.Body>
                            </Table>
                        </CardOverflow>
                    </Card>

                    <Stack spacing={4}>
                        <Card>
                            <CardHeader>
                                <CardTitle>Plan smjene</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <DailySchedule
                                    startDate={
                                        new Date('2026-05-22T00:00:00+02:00')
                                    }
                                    days={3}
                                    renderDay={({ date, index, isToday }) => (
                                        <Row
                                            justifyContent="space-between"
                                            spacing={3}
                                        >
                                            <Stack spacing={1}>
                                                <Typography level="body2">
                                                    <TimeRange
                                                        startAt={date}
                                                        endAt={
                                                            new Date(
                                                                date.getTime() +
                                                                    3 *
                                                                        60 *
                                                                        60 *
                                                                        1000,
                                                            )
                                                        }
                                                    />
                                                </Typography>
                                                <Typography
                                                    level="body3"
                                                    secondary
                                                >
                                                    {isToday
                                                        ? 'Danas'
                                                        : `Dan ${index + 1}`}
                                                </Typography>
                                            </Stack>
                                            <Chip
                                                color={
                                                    index === 0
                                                        ? 'success'
                                                        : 'neutral'
                                                }
                                                size="sm"
                                            >
                                                {index + 4} zadatka
                                            </Chip>
                                        </Row>
                                    )}
                                />
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Postavke pregleda</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Stack spacing={4}>
                                    <ControlledSelect />
                                    <Checkbox
                                        defaultChecked
                                        label="Sakrij zavrsene radnje"
                                    />
                                    <Checkbox
                                        checked="indeterminate"
                                        label="Djelomicno odabrane zone"
                                    />
                                    <Switch
                                        defaultChecked
                                        label="Obavijesti o promjenama"
                                    />
                                    <ControlledSlider />
                                </Stack>
                            </CardContent>
                            <CardActions justifyContent="end">
                                <Modal
                                    title="Detalji smjene"
                                    trigger={
                                        <Button
                                            type="button"
                                            variant="outlined"
                                        >
                                            Otvori modal
                                        </Button>
                                    }
                                >
                                    <Stack spacing={3}>
                                        <Typography level="h5">
                                            Detalji smjene
                                        </Typography>
                                        <Typography>
                                            Modal keeps focused task context
                                            close to the triggering action.
                                        </Typography>
                                    </Stack>
                                </Modal>
                                <ModalConfirm
                                    title="Potvrdi arhiviranje"
                                    header="Arhivirati zavrsene radnje?"
                                    confirmLabel="Arhiviraj"
                                    trigger={
                                        <Button color="warning" type="button">
                                            Potvrdi
                                        </Button>
                                    }
                                >
                                    Zavrsene radnje ostaju dostupne kroz
                                    povijest.
                                </ModalConfirm>
                            </CardActions>
                        </Card>
                    </Stack>
                </div>
            </Stack>
        </Container>
    );
}

function PublicContentShowcase() {
    return (
        <div className="min-h-screen">
            <PageNav
                logo={
                    <Typography component="span" level="h6" semiBold>
                        Gredice
                    </Typography>
                }
                links={[
                    { href: '/', text: 'Biljke' },
                    { href: '/', text: 'Dostava' },
                    { href: '/', text: 'Recepti' },
                ]}
            >
                <IconButton aria-label="Pretraga">
                    <Search className="size-5" />
                </IconButton>
            </PageNav>

            <Container className="pt-24 pb-12" maxWidth="xl">
                <Stack spacing={12}>
                    <PageHeaderSection
                        header="Vodic kroz proljetnu sadnju"
                        description="Public content composition with CMS sections, media, text rendering, and navigation controls."
                    />

                    <Heading1
                        tagline="Sezonski vodic"
                        header="Plan sadnje koji se moze provjeriti"
                        description="Storybook showcase uses real page composition pieces instead of isolated decorative cards."
                        ctas={[
                            {
                                label: 'Otvori katalog',
                                href: '/',
                                icon: <Sprout className="size-4" />,
                            },
                            {
                                label: 'Procitaj uvjete',
                                href: '/',
                                secondary: true,
                            },
                        ]}
                    />

                    <Feature1
                        tagline="Sto korisnik vidi"
                        header="Biljke, blokovi i savjeti"
                        description="Feature sections combine CTA buttons, feature lists, and optional assets."
                        asset={
                            <Card className="max-w-sm overflow-hidden">
                                <CardOverflow>
                                    <BlockImage
                                        alt="Podignuta gredica"
                                        blockName="Raised_Bed_1"
                                        width={360}
                                        height={220}
                                        className="h-56 w-full object-contain"
                                    />
                                </CardOverflow>
                            </Card>
                        }
                        features={[
                            {
                                header: 'Kalendar sjetve',
                                description:
                                    'Seed badges explain when a plant is ready for sowing.',
                                asset: <SeedTimeInformationBadge />,
                            },
                            {
                                header: 'Procjena prinosa',
                                description: (
                                    <PlantYieldTooltip
                                        plant={{
                                            information: { name: 'Rajcica' },
                                            attributes: {
                                                seedingDistance: 35,
                                                yieldMin: 800,
                                                yieldMax: 1200,
                                                yieldType: 'perPlant',
                                            },
                                        }}
                                    >
                                        Rajcica
                                    </PlantYieldTooltip>
                                ),
                            },
                        ]}
                    />

                    <TextBlock
                        tagline="Tekstualna sekcija"
                        header="Reusable CMS text block"
                        description="TextBlock keeps long-form CMS copy in a readable width while preserving optional calls to action."
                        ctas={[
                            { label: 'Primary link', href: '/' },
                            {
                                label: 'Secondary link',
                                href: '/',
                                secondary: true,
                            },
                        ]}
                    />

                    <MarkdownBlock markdown="## Markdown CMS section\n\nMarkdownBlock renders author-provided Markdown with the shared Markdown and StyledHtml primitives.\n\n- Supports lists\n- Supports **emphasis**\n- Supports [links](/)" />

                    <HtmlBlock html="<h2>HTML CMS section</h2><p>HtmlBlock renders trusted author-provided HTML with the shared StyledHtml primitive.</p><ul><li>Styled lists</li><li>Styled text</li></ul>" />

                    <MediaBlock
                        tagline="Media layout"
                        header="Text can pair with a managed visual"
                        description="MediaBlock is a generic two-column CMS section for image-led explanations, product context, or editorial content."
                        assetUrl={cmsMediaPreviewUrl}
                        assetAlt="CMS section visual preview"
                    />

                    <CardGrid
                        tagline="Grid layout"
                        header="Cards for repeated section content"
                        description="CardGrid supports reusable cards without tying the section store to one page or product flow."
                        features={[
                            {
                                header: 'First card',
                                description:
                                    'Short content for the first reusable card.',
                            },
                            {
                                header: 'Second card',
                                description:
                                    'Short content for the second reusable card.',
                            },
                            {
                                header: 'Third card',
                                description:
                                    'Short content for the third reusable card.',
                            },
                        ]}
                    />

                    <CtaBand
                        tagline="Next step"
                        header="Focused call to action"
                        description="CtaBand gives CMS authors a reusable conversion section with primary and secondary actions."
                        ctas={[
                            { label: 'Continue', href: '/' },
                            {
                                label: 'Learn more',
                                href: '/',
                                secondary: true,
                            },
                        ]}
                    />

                    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
                        <Card>
                            <CardHeader>
                                <CardTitle>Plant gallery</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Gallery
                                    items={galleryPlants}
                                    itemComponent={PlantGalleryCard}
                                    gridHeader="Popularno za sadnju"
                                    gridFilters={
                                        <Row spacing={2}>
                                            <Chip size="sm">Sve</Chip>
                                            <Chip size="sm" variant="outlined">
                                                Sjetva
                                            </Chip>
                                        </Row>
                                    }
                                    filters={() => (
                                        <Stack spacing={3}>
                                            <FilterInput
                                                fieldName="public-search"
                                                searchParamName="public-q"
                                            />
                                            <Checkbox
                                                label="Samo dostupno"
                                                defaultChecked
                                            />
                                        </Stack>
                                    )}
                                />
                            </CardContent>
                        </Card>

                        <Stack spacing={4}>
                            <Card>
                                <CardHeader>
                                    <CardTitle>Media tools</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <Stack spacing={4}>
                                        <ImageGallery
                                            images={sampleImages}
                                            previewHeight={160}
                                            previewWidth={260}
                                            previewVariant="stacked"
                                        />
                                        <ImageViewer
                                            src={sampleImages[0].src}
                                            alt={sampleImages[0].alt}
                                            previewHeight={140}
                                            previewWidth={260}
                                        />
                                    </Stack>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Rich text</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <Stack spacing={4}>
                                        <Tabs defaultValue="markdown">
                                            <TabsList>
                                                <TabsTrigger value="markdown">
                                                    Markdown
                                                </TabsTrigger>
                                                <TabsTrigger value="html">
                                                    HTML
                                                </TabsTrigger>
                                            </TabsList>
                                            <TabsContent value="markdown">
                                                <Markdown>
                                                    {
                                                        '### Upute\\n\\n- Beri ujutro.\\n- Zalij nakon berbe.\\n\\n[Detalji](/)'
                                                    }
                                                </Markdown>
                                            </TabsContent>
                                            <TabsContent value="html">
                                                <StyledHtml>
                                                    <h3>Kratki opis</h3>
                                                    <p>
                                                        StyledHtml keeps CMS
                                                        copy aligned with the
                                                        public content theme.
                                                    </p>
                                                    <hr />
                                                    <a href="/">Poveznica</a>
                                                </StyledHtml>
                                            </TabsContent>
                                        </Tabs>
                                        <Link
                                            href="/"
                                            className="text-primary underline"
                                        >
                                            Link primitive in content context
                                        </Link>
                                    </Stack>
                                </CardContent>
                            </Card>
                        </Stack>
                    </div>

                    <SectionsView
                        debug
                        componentsRegistry={{
                            Faq1,
                        }}
                        sectionsData={[
                            {
                                component: 'Faq1',
                                tagline: 'FAQ',
                                header: 'Cesta pitanja',
                                description:
                                    'CMS registry sections render known components and expose missing mappings in debug mode.',
                                features: [
                                    {
                                        header: 'Kako se bira termin dostave?',
                                        description:
                                            'Korisnik bira slobodan slot, a operacije ga mogu potvrditi.',
                                    },
                                    {
                                        header: 'Kada se gredica sadi?',
                                        description:
                                            'Sjetveni kalendar pomaze odabrati pravo vrijeme.',
                                    },
                                ],
                            },
                        ]}
                    />

                    <SectionsView
                        componentsRegistry={{
                            MediaBlock,
                            TextBlock,
                        }}
                        renderMode="container"
                        renderMaxWidth="sm"
                        sectionsData={[
                            {
                                component: 'TextBlock',
                                tagline: 'Page layout',
                                header: 'Page-level container',
                                description:
                                    'This section inherits a narrow page container.',
                            },
                            {
                                component: 'MediaBlock',
                                renderMode: 'fullWidth',
                                tagline: 'Section override',
                                header: 'Break out when needed',
                                description:
                                    'Individual CMS sections can override the page layout.',
                                assetUrl: cmsMediaPreviewUrl,
                                assetAlt: 'CMS layout override preview',
                            },
                        ]}
                    />

                    <Faq1
                        header="Dodatne provjere"
                        features={[
                            {
                                header: 'Mogu li promijeniti narudzbu?',
                                description:
                                    'Promjene su moguce dok narudzba nije u obradi.',
                            },
                        ]}
                    />

                    <Footer1
                        tagline="Gredice"
                        asset={
                            <Typography level="h6" semiBold>
                                Gredice
                            </Typography>
                        }
                        ctas={[
                            {
                                label: 'Facebook',
                                href: '/',
                                icon: <CompanyFacebook />,
                            },
                            {
                                label: 'GitHub',
                                href: '/',
                                icon: <CompanyGitHub />,
                            },
                            {
                                label: 'Reddit',
                                href: '/',
                                icon: <CompanyReddit />,
                            },
                            {
                                label: 'X',
                                href: '/',
                                icon: <CompanyX />,
                            },
                        ]}
                        features={[
                            {
                                header: 'Sadrzaj',
                                ctas: [
                                    { label: 'Biljke', href: '/' },
                                    { label: 'Radnje', href: '/' },
                                ],
                            },
                            {
                                header: 'Podrska',
                                ctas: [
                                    { label: 'Kontakt', href: '/' },
                                    { label: 'Status', href: '/' },
                                ],
                            },
                        ]}
                    />
                </Stack>
            </Container>
        </div>
    );
}

function GardenWorkspaceShowcase() {
    const [collapsed, setCollapsed] = useState(false);

    return (
        <Container className="py-8" maxWidth="xl">
            <Stack spacing={8}>
                <PageHeader
                    header="Garden workspace"
                    subHeader="A responsive workbench for garden state, field selection, and HUD-style controls."
                    visual={
                        <div className="grid size-full place-items-center bg-lime-100 text-lime-900">
                            <RaisedBedIcon
                                physicalId="A12"
                                className="size-24"
                            />
                        </div>
                    }
                >
                    <Card>
                        <CardHeader>
                            <CardTitle>Kompozicija polja</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Row className="flex-wrap" spacing={3}>
                                <Grid1Icon className="size-6" />
                                <Grid4Icon className="size-6" />
                                <Grid9Icon className="size-6" />
                                <Grid16Icon className="size-6" />
                                <PlantGridIcon
                                    totalPlants={9}
                                    className="size-6"
                                />
                            </Row>
                        </CardContent>
                    </Card>
                </PageHeader>

                <div className="h-[44rem] overflow-hidden rounded-lg border bg-card">
                    <SplitView
                        size="lg"
                        minSize={280}
                        maxSize={520}
                        collapsable
                        collapsed={collapsed}
                        onCollapsedChanged={setCollapsed}
                    >
                        <Stack className="h-full overflow-auto p-4" spacing={4}>
                            <Row justifyContent="space-between">
                                <Typography level="h5">Gredica A12</Typography>
                                <IconButton
                                    aria-label="Collapse sidebar"
                                    onClick={() =>
                                        setCollapsed((current) => !current)
                                    }
                                    variant="outlined"
                                >
                                    <Settings className="size-4" />
                                </IconButton>
                            </Row>

                            <Accordion defaultOpen>
                                <Typography semiBold>Aktivna faza</Typography>
                                <Stack spacing={4}>
                                    <SegmentedCircularProgress
                                        size={110}
                                        segments={[
                                            {
                                                percentage: 40,
                                                color: 'stroke-lime-600',
                                                trackColor: 'stroke-lime-100',
                                                value: 80,
                                            },
                                            {
                                                percentage: 35,
                                                color: 'stroke-sky-600',
                                                trackColor: 'stroke-sky-100',
                                                value: 55,
                                            },
                                            {
                                                percentage: 25,
                                                color: 'stroke-amber-600',
                                                trackColor: 'stroke-amber-100',
                                                value: 30,
                                            },
                                        ]}
                                    >
                                        <Typography level="body2" semiBold>
                                            64%
                                        </Typography>
                                    </SegmentedCircularProgress>
                                    <Progress value={64} />
                                </Stack>
                            </Accordion>

                            <Accordion defaultOpen variant="plain">
                                <Typography semiBold>Biljke</Typography>
                                <List variant="outlined">
                                    <ListHeader
                                        header="Raspored sadnje"
                                        icon={<PlantingSeedIcon />}
                                        actions={[
                                            <Chip key="ready" size="sm">
                                                3 polja
                                            </Chip>,
                                        ]}
                                    />
                                    <ListItem
                                        label="Rajcica"
                                        selected
                                        nodeId="tomato"
                                        onSelected={() => undefined}
                                        startDecorator={<Sprout />}
                                    />
                                    <ListItem
                                        label="Bosiljak"
                                        nodeId="basil"
                                        onSelected={() => undefined}
                                        startDecorator={<Leaf />}
                                    />
                                    <ListItem
                                        label="Pogledaj povijest"
                                        href="/"
                                        startDecorator={<ArchiveIcon />}
                                    />
                                </List>
                            </Accordion>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Alati</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <Row className="flex-wrap" spacing={2}>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <IconButton
                                                    aria-label="Zalij"
                                                    variant="outlined"
                                                >
                                                    <Droplet className="size-4" />
                                                </IconButton>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                Dodaj zalijevanje
                                            </TooltipContent>
                                        </Tooltip>
                                        <Popper
                                            trigger={
                                                <Button
                                                    type="button"
                                                    variant="outlined"
                                                >
                                                    Biljeska
                                                </Button>
                                            }
                                            className="p-4"
                                        >
                                            <Typography level="body2">
                                                Popper keeps lightweight
                                                contextual controls close to the
                                                field.
                                            </Typography>
                                        </Popper>
                                        <NavigatingButton href="/" hideArrow>
                                            Otvori dnevnik
                                        </NavigatingButton>
                                    </Row>
                                </CardContent>
                            </Card>
                        </Stack>

                        <div className="relative h-full overflow-hidden bg-emerald-50 p-6 dark:bg-emerald-950/20">
                            <LoadingIndicator className="absolute inset-x-0 top-0" />
                            <div className="grid h-full place-items-center">
                                <GentleSlide appear>
                                    <Stack alignItems="center" spacing={6}>
                                        <BlurText
                                            text="A12 spremna za pregled"
                                            className="text-center text-2xl font-medium"
                                        />
                                        <div className="grid grid-cols-3 gap-3">
                                            {Array.from({ length: 9 }).map(
                                                (_, index) => (
                                                    <Card
                                                        // biome-ignore lint/suspicious/noArrayIndexKey: stable grid preview cells do not have persisted ids in this static showcase.
                                                        key={index}
                                                        className="grid size-24 place-items-center"
                                                        variant={
                                                            index === 4
                                                                ? 'secondary'
                                                                : 'default'
                                                        }
                                                    >
                                                        {index === 4 ? (
                                                            <PlantOrSortImage
                                                                coverUrl={
                                                                    sampleImages[0]
                                                                        .src
                                                                }
                                                                alt="Rajcica"
                                                                width={56}
                                                                height={56}
                                                                className="rounded-full"
                                                            />
                                                        ) : (
                                                            <RaisedBedSimpleIcon className="size-8 opacity-70" />
                                                        )}
                                                    </Card>
                                                ),
                                            )}
                                        </div>
                                        <Row className="flex-wrap" spacing={3}>
                                            <OperationImage
                                                operation={{
                                                    information: {
                                                        label: 'Zalijevanje',
                                                    },
                                                    attributes: {
                                                        category: {
                                                            information: {
                                                                name: 'watering',
                                                            },
                                                        },
                                                    },
                                                }}
                                                size={40}
                                            />
                                            <OperationCategoryIcon
                                                categoryName="harvest"
                                                className="size-8"
                                            />
                                            <BackpackIcon className="size-8" />
                                            <ShovelIcon className="size-8" />
                                        </Row>
                                    </Stack>
                                </GentleSlide>
                            </div>
                        </div>
                    </SplitView>
                </div>
            </Stack>
        </Container>
    );
}

function AccountAndStatesShowcase() {
    return (
        <Container className="py-8" maxWidth="xl">
            <Stack spacing={8}>
                <PageHeader
                    header="Account, feedback, and utility states"
                    subHeader="Shared components used by sign-in, diagnostics, empty states, loading states, and destructive flows."
                />

                <div className="grid gap-4 lg:grid-cols-3">
                    <Card>
                        <CardHeader>
                            <CardTitle>Account controls</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <AuthProvider
                                currentUserFactory={async () => ({
                                    id: 'storybook-user',
                                })}
                                urls={{
                                    signIn: '/',
                                    signOut: '/',
                                    signUp: '/',
                                }}
                            >
                                <Stack spacing={3}>
                                    <GoogleLoginButton lastUsed />
                                    <FacebookLoginButton />
                                    <Row spacing={2}>
                                        <SignInButton>Prijava</SignInButton>
                                        <SignUpButton>
                                            Registracija
                                        </SignUpButton>
                                        <UserButton />
                                    </Row>
                                    <AvatarMenuDemo />
                                </Stack>
                            </AuthProvider>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Editable settings</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Stack spacing={4}>
                                <EditableName />
                                <Input
                                    fullWidth
                                    label="Naziv prikaza"
                                    placeholder="Npr. Jutarnji pregled"
                                    helperText="Use Input helper text for compact guidance."
                                    startDecorator={
                                        <Search className="ml-3 size-4" />
                                    }
                                />
                                <Row spacing={2}>
                                    <Button
                                        startDecorator={<Approved />}
                                        type="button"
                                    >
                                        Spremi
                                    </Button>
                                    <Button
                                        color="danger"
                                        type="button"
                                        variant="outlined"
                                    >
                                        Odbaci
                                    </Button>
                                </Row>
                            </Stack>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Feedback states</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Stack spacing={4}>
                                <Row spacing={3}>
                                    <Spinner loadingLabel="Ucitavanje" />
                                    <Typography level="body2">
                                        Sinkronizacija
                                    </Typography>
                                </Row>
                                <Stack spacing={2}>
                                    <Skeleton className="h-4 w-3/4" />
                                    <Skeleton className="h-4 w-1/2" />
                                </Stack>
                                <NoDataPlaceholder>
                                    Nema zapisa za odabrani filter.
                                </NoDataPlaceholder>
                                <Button
                                    type="button"
                                    onClick={() =>
                                        showNotification(
                                            'Promjena je spremljena.',
                                            'success',
                                        )
                                    }
                                >
                                    Prikazi obavijest
                                </Button>
                                <NotificationsContainer />
                            </Stack>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid gap-4 lg:grid-cols-[24rem_minmax(0,1fr)]">
                    <DebugPanel
                        title="Debug controls"
                        description="Utility panels are useful in game and admin instrumentation."
                    >
                        <DebugPanelSection
                            title="Render quality"
                            description="Fine-grained settings stay compact."
                        >
                            <Stack spacing={3}>
                                <ControlledSlider />
                                <Checkbox label="Prikazi granice elemenata" />
                            </Stack>
                        </DebugPanelSection>
                        <DebugPanelSection title="Media">
                            <ImageEditorLauncher />
                        </DebugPanelSection>
                    </DebugPanel>

                    <Card>
                        <CardHeader>
                            <CardTitle>Failure and empty previews</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-4 lg:grid-cols-2">
                                <Card variant="secondary">
                                    <CardHeader>
                                        <CardTitle>Collapsed state</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <Collapse appear={false}>
                                            <Typography>
                                                Hidden content remains in the
                                                flow only when expanded.
                                            </Typography>
                                        </Collapse>
                                        <NoDataPlaceholder />
                                    </CardContent>
                                </Card>
                                <Card variant="secondary">
                                    <CardHeader>
                                        <CardTitle>
                                            Error boundary view
                                        </CardTitle>
                                    </CardHeader>
                                    <CardOverflow className="h-96 overflow-hidden border-t">
                                        <ErrorFallback
                                            correlationId="story-2026-05-22"
                                            onRetry={() => undefined}
                                        />
                                    </CardOverflow>
                                </Card>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Visual inventory strip</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Stack spacing={4}>
                            <Row className="flex-wrap" spacing={4}>
                                <ArchiveIcon className="size-8" />
                                <BackpackIcon className="size-8" />
                                <PlantingSeedIcon className="size-8" />
                                <RaisedBedSimpleIcon className="size-8" />
                                <RaisedBedIdentifierIcon physicalId="D7" />
                                <Store className="size-8" />
                                <Truck className="size-8" />
                                <Home className="size-8" />
                                <Info className="size-8" />
                            </Row>
                            <Divider />
                            <Typography level="body3" secondary>
                                Divider separates dense icon references from
                                neighboring content.
                            </Typography>
                        </Stack>
                    </CardContent>
                </Card>
            </Stack>
        </Container>
    );
}

function ShowcaseSurface() {
    return <OperationsDashboardShowcase />;
}

const meta = {
    title: 'packages/ui/Showcases/ComponentShowcases',
    component: ShowcaseSurface,
    tags: ['autodocs'],
    parameters: {
        layout: 'fullscreen',
        docs: {
            description: {
                component:
                    'Scenario-driven pages that exercise the shared @gredice/ui component surface across realistic product contexts.',
            },
        },
    },
} satisfies Meta<typeof ShowcaseSurface>;

export default meta;

type Story = StoryObj<typeof meta>;

export const OperationsDashboard: Story = {
    render: () => <OperationsDashboardShowcase />,
};

export const PublicContentPage: Story = {
    render: () => <PublicContentShowcase />,
};

export const GardenWorkspace: Story = {
    render: () => <GardenWorkspaceShowcase />,
};

export const AccountAndStates: Story = {
    render: () => <AccountAndStatesShowcase />,
};
