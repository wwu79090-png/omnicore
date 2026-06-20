# Offline and Private Deployment

OmniCore can be distributed without npm, GitHub access, or an internet connection after the offline package is built.

## Target users

- 企业内部 teams that need a controlled intranet build.
- 教育机构 that need classroom machines to run without npm install.
- Game jam or training rooms that distribute the same package through USB.
- Review teams that need a fixed build for compliance checks.

## Build the offline package

```bash
npm run dist:full
```

The command produces:

```text
OmniCore-v1.0.0-Offline.zip
```

The zip should include `start.html`, `README.md`, `docs/`, `examples/`, `dist/`, and default assets.

## Single-machine use

1. Copy `OmniCore-v1.0.0-Offline.zip` to the target machine.
2. Extract it into a writable folder.
3. Double-click `start.html`.
4. Open the included examples and docs from the local folder.

No Node.js runtime is required for this static path.

## 内网服务器

1. Extract the zip on an internal HTTP server.
2. Serve the folder as static files.
3. Keep the directory read-only for normal users.
4. Publish the intranet URL to the team.

Use this mode when browsers block some local file APIs or when a classroom wants one shared URL.

## USB distribution

1. Extract the package once.
2. Copy the extracted folder to the USB drive.
3. Keep `start.html` at the root of the copied folder.
4. Include a `checksums.txt` file for verification.

## 校验

Before distributing, verify:

- `start.html` opens on a clean browser profile.
- `dist/omnicore.esm.js` exists.
- `examples/` pages load without network access.
- Screenshots and docs assets resolve locally.
- The package checksum matches the release record.

## Update policy

For enterprise and education deployments, keep one approved offline zip per course, semester, or production milestone. Do not replace files in place; publish a new folder with a new version number and archive the old one.
