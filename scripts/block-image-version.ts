import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";

export function getBlockImageAssetVersion(directories: URL[]) {
	const hash = createHash("sha256");

	for (const directory of directories) {
		const fileNames = readdirSync(directory)
			.filter((fileName) => fileName.endsWith(".webp"))
			.sort();

		for (const fileName of fileNames) {
			hash.update(fileName);
			hash.update("\0");
			hash.update(readFileSync(new URL(fileName, directory)));
			hash.update("\0");
		}
	}

	return hash.digest("hex").slice(0, 16);
}
