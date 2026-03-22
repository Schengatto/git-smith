# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do not** open a public GitHub issue
2. Send a detailed report to the maintainers via [GitHub Security Advisories](https://github.com/Schengatto/git-smith/security/advisories/new)
3. Include steps to reproduce the vulnerability
4. Allow reasonable time for a fix before public disclosure

We will acknowledge receipt within 48 hours and aim to release a fix within 7 days for critical vulnerabilities.

## Security Considerations

GitSmith is a desktop application that executes git commands on the user's local system. Key security measures:

- **Context isolation** is enabled — the renderer process cannot access Node.js APIs directly
- **Node integration** is disabled in the renderer
- All IPC communication goes through a typed `contextBridge` preload API
- Git commands are executed via `simple-git`, which uses the system git binary
- No remote code execution — the app does not load external URLs
- ASAR packaging is enabled for distribution builds
