// Write all blocks data to a file

import { writeFile } from 'fs/promises';

const entities = await fetch('https://api.gredice.com/api/directories/entities/block').then(res => res.json());
await writeFile('./generate/test-cases.json', JSON.stringify(entities, null, 2));
