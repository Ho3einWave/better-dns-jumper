![GitHub Downloads (all assets, all releases)](https://img.shields.io/github/downloads/ho3einwave/better-dns-jumper/total?style=for-the-badge&color=blue)
![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/ho3einwave/better-dns-jumper/release.yml?style=for-the-badge)
![GitHub package.json dynamic](https://img.shields.io/github/package-json/version/ho3einwave/better-dns-jumper?style=for-the-badge)
![GitHub Repo stars](https://img.shields.io/github/stars/ho3einwave/better-dns-jumper?style=for-the-badge&logo=github&color=%23f7d000)


# Better DNS Jumper

A fast, modern DNS manager built with **Tauri (Rust + React)**. Switch DNS servers, manage network interfaces, and use DNS-over-HTTPS (DoH) through a clean, lightweight interface.

## Installation

### Download

Grab the latest version from the **[Releases](https://github.com/Ho3einWave/better-dns-jumper/releases)** page.


## Related Projects

### [cf-doh-worker](https://github.com/Ho3einWave/cf-doh-worker)

If you are looking for a **private, custom DNS-over-HTTPS (DoH) endpoint** to use with **Better DNS Jumper**'s DoH feature, check out the `cf-doh-worker` repository.

This project is a very minimalist DoH proxy designed to run on **Cloudflare Workers**. It allows you to:
* Quickly deploy your own private, highly-available DoH server.
* Use a DoH endpoint under your own domain to potentially bypass restrictions on known public DoH providers.

You can then configure the URL of your deployed Cloudflare Worker as a custom DoH server within the **Better DNS Jumper** application.


## Features

* **DNS Protocols**

  * Traditional DNS (IPv4)
  * DNS-over-HTTPS with local proxy

* **Network Management**

  * View and select interfaces
  * Auto-detect best interface
  * Set / clear DNS per interface

* **DNS Servers**

  * Built-in popular servers (Google, Cloudflare, Quad9, AdGuard…)
  * Custom server support
  * DoH latency/availability testing

* **Tools**

  * Clear DNS cache
  * Reset DNS settings
  * Auto-start
  * Auto-update

* **UI**

  * Modern dark UI (React + HeroUI)
  * Smooth animations (Framer Motion)


### Build from Source

```bash
git clone https://github.com/Ho3einWave/better-dns-jumper.git
cd better-dns-jumper
npm install    # or bun install
npm run tauri dev
npm run tauri build
```

## Usage

1. Launch the app (admin required)
2. Select a network interface (or use Auto)
3. Choose protocol: **DNS** or **DoH**
4. Pick a server
5. Toggle **Activate** to apply
6. Optional tools: clear cache, reset DNS, test DoH

## Technical Overview

* **Frontend**: React + TypeScript + Tailwind + HeroUI
* **Backend**: Rust (Tauri 2)
* **DNS Engine**: Hickory DNS
* **Windows Integration**: IP Helper API + WMI
* **DoH Mode**: Runs a local DNS proxy (`127.0.0.2`) that forwards queries to the selected DoH server

Project structure:

```
src/             # React frontend
src-tauri/       # Rust backend
```

## Roadmap

- [ ] Improved error handling
- [x] Clean exit & automatic DNS restore
- [ ] Better logs & in-app log viewer
- [ ] DNS-over-TLS / DNS-over-QUIC / DoH3
- [ ] Reduce WMI usage
- [ ] CLI support
- [ ] Multi-language support
- [ ] Syncable DNS profiles

## Contributing

PRs are welcome. For major changes, open an issue first.

## License

GPLv3 — see `LICENSE`.

