# 🚀 Espander

<p align="center">
  <strong>A modern visual manager for Espanso snippets.</strong><br>
  Create, organize, import, export, and sync your text expansion snippets without manually editing YAML files.
</p>

<p align="center">
  <img src="https://img.shields.io/github/license/ashikhosenpro/Expander" alt="License">
  <img src="https://img.shields.io/github/v/release/ashikhosenpro/Expander" alt="Latest Release">
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows-blue" alt="Platform">
  <img src="https://img.shields.io/badge/Built%20With-Tauri-orange" alt="Tauri">
</p>

---

## ✨ Overview

Espander is an open-source desktop application that provides a visual interface for managing **Espanso** snippets.

Instead of manually editing YAML files, Espander lets you manage snippets through an intuitive desktop application while keeping full compatibility with Espanso.

Whether you're a developer, writer, customer support agent, or power user, Espander makes managing text expansions significantly easier.

---

# 👤 For End Users

## Features

- 🎯 Visual snippet editor
- 📂 Category-based organization
- 🔄 Two-way GitHub synchronization
- 📥 Import snippets from CSV
- 📤 Export to CSV or YAML
- ☁️ Local-first workflow
- 🔐 Secure GitHub token storage
- 🖥️ Native macOS & Windows application
- 🔔 Built-in update notifications

---

## Download

Download the latest version from GitHub Releases:

**https://github.com/ashikhosenpro/Expander/releases**

Available installers:

- macOS (.dmg)
- Windows (.exe)

No additional software such as Node.js, Rust, or Espanso development tools is required to install or use Espander.

---

## Installation

### macOS

1. Download the latest `.dmg`
2. Open the installer
3. Drag **Espander** into the Applications folder
4. Launch the application

### Windows

1. Download the latest `.exe`
2. Run the installer
3. Follow the setup wizard
4. Launch Espander

---

## Screenshots

Screenshots will be added after the first public release.

---

# 👨‍💻 For Developers

## Tech Stack

- Tauri v2
- React
- TypeScript
- Rust
- Vite

---

## Development Setup

### Requirements

- Node.js 22 or newer
- Rust (stable)
- Tauri prerequisites

Clone the repository:

```bash
git clone https://github.com/ashikhosenpro/Expander.git

cd Expander
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run tauri:dev
```

Build the application:

```bash
npm run tauri:build
```

## Project Features

- Visual YAML editor
- Espanso-compatible snippet generation
- GitHub repository synchronization
- CSV import/export
- YAML import/export
- Secure credential management
- Cross-platform desktop application
- Automatic update metadata
- Notification metadata support

---

## Testing

Frontend build:

```bash
npm run build
```

Rust checks:

```bash
cargo check --manifest-path src-tauri/Cargo.toml
```

Run tests:

```bash
cargo test --manifest-path src-tauri/Cargo.toml
```

---

## GitHub Synchronization

Espander supports direct synchronization with GitHub repositories.

Recommended Personal Access Token permissions:

- Repository access
- Contents: Read & Write
- Metadata: Read-only

Authentication tokens are stored securely using the operating system's credential manager whenever available.

---

## Contributing

Contributions are always welcome.

If you'd like to improve Espander, please read:

- CONTRIBUTING.md
- SECURITY.md

before opening an issue or pull request.

---

## Roadmap

Upcoming features include:

- Linux support
- Cloud synchronization
- Advanced snippet search
- Keyboard shortcut customization
- Theme support
- Plugin system

---

## License

This project is licensed under the MIT License.

See the LICENSE file for more information.

---

<p align="center">
Made with ❤️ for the Espanso community.
</p>
