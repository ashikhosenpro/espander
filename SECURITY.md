# Security Policy

## Reporting a Vulnerability

Please do not open a public issue for sensitive security reports.

Send a private report to the maintainer with:

- A clear description of the issue
- Steps to reproduce
- Impact and affected versions
- Any proof-of-concept details that are safe to share

## Security Notes

- GitHub tokens are stored in the operating system credential store when available.
- If secure credential storage is unavailable, Espander falls back to a local token file with restricted file permissions on Unix systems.
- The app does not require a hosted backend for snippet sync.
- Fine-grained GitHub tokens should be limited to a single repository with Contents Read/Write and Metadata Read-only permissions.
- Automatic update downloads are restricted to official GitHub Release asset URLs.
- Do not commit `.espander`, `.github_token`, `.env`, build artifacts, or signing credentials.

## Supported Versions

Until the first stable release, only the latest public release receives security fixes.
