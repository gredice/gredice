The Admin operation-photo editor uses the versioned React package built in the
Retusha repository. Version 0.1.0 comes from commit
`f9a470b7b948d77db8ba56f0ca0884fa9695c657` in `AleksandarDev/retusha`.
The archive is included here so deployment can install the
same build through the normal frozen pnpm lockfile.

To update it, run `npm pack ./packages/inline-editor` in the Retusha checkout
after installing its dependencies. Copy the new versioned archive here, update
the file dependency in `apps/app/package.json`, and run `pnpm install` at the
Gredice root. The operation-completion browser test exercises the packed editor.
