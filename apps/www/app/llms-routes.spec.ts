import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const llmsRoutePath = path.join(process.cwd(), 'app/llms.txt/route.ts');
const llmsFullRoutePath = path.join(process.cwd(), 'app/llms-full.txt/route.ts');

function read(filePath: string) {
    return readFileSync(filePath, 'utf8');
}

test('llms.txt route serves plain text with core sections and canonical links', () => {
    const source = read(llmsRoutePath);

    assert.match(source, /Content-Type':\s*'text\/plain; charset=utf-8'/);
    assert.match(source, /# Gredice/);
    assert.match(source, /## Core Resources/);
    assert.match(source, /## Company and Support/);
    assert.match(source, /## Policies/);
    assert.match(source, /\[Home\]\(https:\/\/www\.gredice\.com\/\)/);
    assert.match(source, /\[Plants\]\(https:\/\/www\.gredice\.com\/biljke\)/);
    assert.match(source, /\[Privacy policy\]\(https:\/\/www\.gredice\.com\/legalno\/politika-privatnosti\)/);
});

test('llms-full.txt route is available and wired to llms.txt handler', () => {
    const source = read(llmsFullRoutePath);

    assert.match(source, /export\s*\{\s*GET\s*\}\s*from\s*'\.\.\/llms\.txt\/route'/);
});
