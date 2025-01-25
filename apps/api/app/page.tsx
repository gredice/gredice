import { Typography } from '@signalco/ui-primitives/Typography';
import { List } from '@signalco/ui-primitives/List';
import { ListItem } from '@signalco/ui-primitives/ListItem';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Card, CardOverflow } from '@signalco/ui-primitives/Card';
import { Navigate } from '@signalco/ui-icons';
import Link from 'next/link';

export default function Home() {
  return (
    <Stack spacing={1} className='p-4'>
      <Typography level='body2'>API Reference</Typography>
      <Card>
        <CardOverflow>
          <List variant='outlined'>
            <Link href="/docs/directories" legacyBehavior passHref prefetch>
              <ListItem variant='outlined' label="/api/directories" href="/docs/directories" endDecorator={<Navigate />} />
            </Link>
          </List>
        </CardOverflow>
      </Card>
    </Stack>
  );
}

