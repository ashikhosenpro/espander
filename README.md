# Espander

Espander is an open-source visual manager and sync companion for [Espanso](https://espanso.org/). It helps you create text-expansion snippets, organize them into categories, import/export data, and sync category YAML files with GitHub.

## Download

Stable desktop builds are published from GitHub Releases:

- macOS: download the `.dmg` asset from the latest release
- Windows: download the `.exe` installer asset from the latest release

Latest releases: <https://github.com/ashikhosenpro/Expander/releases>

> The first public release is planned as `v0.1.0`. Release assets are generated automatically by GitHub Actions when a `v*` tag is pushed.

## Features

- Visual snippet manager for Espanso
- Category-based YAML generation
- Local-only mode
- Google Sheets CSV import
- GitHub two-way YAML sync
- CSV and YAML import/export
- macOS/Windows permission status panel
- Remote update and notification metadata support

## Screenshots

Screenshots will be added after the first public release.

## Development

Requirements:

- Node.js 22 or newer
- Rust stable
- Tauri prerequisites for your OS

Install dependencies:

```bash
npm install
```

Run the desktop app locally:

```bash
npm run tauri:dev
```

Build the frontend:

```bash
npm run build
```

Build desktop packages:

```bash
npm run tauri:build
```

Run checks:

```bash
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
```

## GitHub Sync

Use a fine-grained GitHub Personal Access Token with:

- Repository access: only the selected snippets repository
- Contents: Read and Write
- Metadata: Read-only

Espander stores tokens in the operating system credential store when available. If that fails, it falls back to a local file under the user's `.espander` directory with owner-only permissions on Unix systems.

## WordPress Control Hub

Espander can read top-bar notifications, update metadata, documentation, and about content
from a WordPress REST API. A small WordPress plugin is included at
`wordpress/espander-notifications`.

1. Upload `wordpress/espander-notifications` to your WordPress site's `wp-content/plugins/`
   directory.
2. Activate **Espander Control Hub** in the WordPress dashboard.
3. Manage notifications, application updates, documentation, about content, and anonymous
   install counts from **Espander Hub** in the WordPress admin menu.
4. Build Espander with your WordPress notification endpoint:

```bash
ESPANDER_NOTIFICATIONS_URL="https://your-domain.com/wp-json/espander/v1/notifications" npm run tauri:build
```

For local development you can run Tauri with the same environment variable:

```bash
ESPANDER_NOTIFICATIONS_URL="https://your-domain.com/wp-json/espander/v1/notifications" npm run tauri:dev
```

The endpoint only exposes published notification data for the app to read. Creating,
editing, deleting, update publishing, documentation editing, and stats overview stay inside
the WordPress dashboard and require a WordPress admin account.

When `ESPANDER_NOTIFICATIONS_URL` is set, Espander automatically derives related endpoints:

- Updates: `/wp-json/espander/v1/update`
- Documentation: `/wp-json/espander/v1/content/docs`
- About: `/wp-json/espander/v1/content/about`
- Footer: `/wp-json/espander/v1/content/footer`
- Anonymous install telemetry: `/wp-json/espander/v1/telemetry`

## Release Metadata

For safety, automatic update downloads are restricted to official GitHub Release asset URLs under `https://github.com/ashikhosenpro/Expander/releases/download/`.

## Releasing

1. Update versions in `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json`.
2. Publish the GitHub Release and update release notes/download URLs if your update metadata flow uses them.
3. Commit the changes.
4. Create and push a tag, for example:

```bash
git tag v0.1.0
git push origin main --tags
```

GitHub Actions builds macOS and Windows packages, uploads workflow artifacts, and attaches `.dmg`, `.exe`, and `.msi` files to the GitHub Release.

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md) before opening issues or pull requests.

## License

MIT License. See [LICENSE](LICENSE).
