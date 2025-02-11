import { Typography } from '@signalco/ui-primitives/Typography';
import { List } from '@signalco/ui-primitives/List';
import { ListItem } from '@signalco/ui-primitives/ListItem';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Card, CardOverflow } from '@signalco/ui-primitives/Card';
import { Navigate } from '@signalco/ui-icons';
import Link from 'next/link';

const apis = [
  { label: '/api/auth', href: '/docs/auth' },
  { label: '/api/accounts', href: '/docs/accounts' },
  { label: '/api/users', href: '/docs/users' },
  { label: '/api/directories', href: '/docs/directories' },
  { label: '/api/data', href: '/docs/data' },
  { label: '/api/gardens', href: '/docs/gardens' },
];

export default function Home() {
  return (
    <Stack spacing={1} className='p-4'>
      <Typography level='body2'>API Reference</Typography>
      <Card>
        <CardOverflow>
          <List variant='outlined'>
            {apis.map(({ label, href }) => (
              <Link key={label} href={href} legacyBehavior passHref prefetch>
                <ListItem variant='outlined' label={label} href={href} endDecorator={<Navigate />} />
              </Link>
            ))}
          </List>
        </CardOverflow>
      </Card>
    </Stack>
  );
}

