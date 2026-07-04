# Contributing to Espander

Thanks for helping improve Espander. This project is intended to stay friendly, practical, and easy to run locally.

## Development Setup

Requirements:

- Node.js 22 or newer
- Rust stable
- Tauri prerequisites for your operating system

Install dependencies:

```bash
npm install
```

Run the app in development mode:

```bash
npm run tauri:dev
```

## Checks

Before opening a pull request, run:

```bash
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
```

## Pull Requests

- Keep changes focused and easy to review.
- Update documentation when behavior changes.
- Do not commit build artifacts, local app data, tokens, or signing credentials.
- For UI-only changes, include a short before/after description or screenshots when helpful.

## Security Issues

Please do not open public issues for sensitive reports. Follow `SECURITY.md` instead.
