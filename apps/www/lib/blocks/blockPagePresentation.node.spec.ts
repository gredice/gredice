import assert from 'node:assert/strict';
import test from 'node:test';
import {
    blockPageDescription,
    blockPageTitle,
    blockTypeDescriptor,
    blockVirtualItemNote,
} from './blockPagePresentation.ts';

const sandBlock = {
    information: {
        label: 'Pijesak',
        shortDescription:
            'Pijesak je ukrasni blok kojim u virtualnom vrtu uređuješ staze i pješčane površine',
    },
    attributes: { type: 'decoration' },
};

test('decorative block pages say they describe a virtual item', () => {
    assert.equal(
        blockPageTitle(sandBlock),
        'Pijesak – ukrasni blok za virtualni vrt',
    );
    assert.equal(
        blockPageDescription(sandBlock),
        'Pijesak je ukrasni blok kojim u virtualnom vrtu uređuješ staze i pješčane površine. Na ovoj stranici prikazujemo predmet iz aplikacije Gredice.',
    );
});

test('every block type resolves to a virtual garden descriptor', () => {
    const descriptors = [
        'decoration',
        'raisedBed',
        'raisedBedPart',
        'plant',
        'plantPart',
        'nepoznato',
        null,
    ].map((type) =>
        blockTypeDescriptor({
            information: { label: 'Blok' },
            attributes: { type },
        }),
    );

    for (const descriptor of descriptors) {
        assert.match(descriptor, /virtualn/u);
    }

    assert.equal(descriptors.at(-1), 'blok za virtualni vrt');
    assert.equal(descriptors.at(-2), 'blok za virtualni vrt');
});

test('blocks without a description still introduce themselves', () => {
    assert.equal(
        blockPageDescription({
            information: { label: 'Kamena staza' },
            attributes: { type: 'decoration' },
        }),
        `Kamena staza je ukrasni blok za virtualni vrt. ${blockVirtualItemNote}`,
    );
});

test('long descriptions leave room for the virtual item note', () => {
    const description = blockPageDescription({
        information: {
            label: 'Blok',
            shortDescription: 'Opis '.repeat(80),
        },
        attributes: { type: 'decoration' },
    });

    assert.ok(description.endsWith(blockVirtualItemNote));
    assert.ok(description.length <= 190);
});
