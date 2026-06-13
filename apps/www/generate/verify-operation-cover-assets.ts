import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import {
    directoryOperationCoverRecipes,
    validateOperationCoverRecipes,
} from './operation-cover-recipes';

const publicIconDirectory = join(
    process.cwd(),
    '../../apps/www/public/assets/operation-icons',
);

async function fileExists(path: string) {
    try {
        const file = await stat(path);
        return file.isFile() && file.size > 0;
    } catch {
        return false;
    }
}

async function main() {
    const recipeValidationErrors = validateOperationCoverRecipes(
        directoryOperationCoverRecipes,
    );
    if (recipeValidationErrors.length > 0) {
        throw new Error(
            `Invalid operation cover recipes:\n${recipeValidationErrors.join('\n')}`,
        );
    }

    const missingFiles: string[] = [];
    for (const recipe of directoryOperationCoverRecipes) {
        const outputPath = join(publicIconDirectory, recipe.outputFileName);
        if (!(await fileExists(outputPath))) {
            missingFiles.push(recipe.outputFileName);
        }
    }

    if (missingFiles.length > 0) {
        throw new Error(
            `Missing operation cover assets:\n${missingFiles.join('\n')}`,
        );
    }

    console.log(
        JSON.stringify(
            {
                checked: directoryOperationCoverRecipes.length,
                directory: publicIconDirectory,
            },
            null,
            2,
        ),
    );
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
