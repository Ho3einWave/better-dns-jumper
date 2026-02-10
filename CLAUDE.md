# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Better DNS Jumper is a Windows desktop DNS manager built with Tauri 2 (Rust backend + React frontend). It lets users switch DNS servers, manage network interfaces, and run a local DNS-over-HTTPS proxy. Requires admin privileges (UAC) to modify system DNS settings.

## Commands

```bash
# Install dependencies (bun or npm)
bun install          # preferred
npm install

# Development (launches both Vite dev server and Rust backend)
npm run tauri dev

# Production build (outputs Windows installer/executable)
npm run tauri build

# Frontend only (no Rust backend, runs on port 1420)
npm run dev

# Type check + frontend build
npm run build
```

There are no test or lint commands configured.

## Architecture

### IPC Data Flow

```
React UI → Custom Hooks (useDns, useInterfaces) → React Query mutations/queries
    → tauri invoke() IPC → Rust #[tauri::command] handlers
    → Windows APIs (WMI + IP Helper) / Hickory DNS engine
```

### Frontend (`src/`)

- **Screens** (`src/screens/`): Route pages — main DNS control, server management, network interfaces, settings
- **Hooks** (`src/hooks/`): `useDns` (DNS mutations/queries), `useInterfaces` (network adapters), `useDnsState` (active DNS state), `useUpdater` (auto-update)
- **Stores** (`src/stores/`): Zustand stores for client state. Server list and settings persist via `tauri-plugin-store`
- **Routing**: Hash-based via React Router (`src/routes.tsx`). Routes: `/`, `/servers`, `/network-interfaces`, `/settings`
- **Providers** (`src/providers.tsx`): HeroUI, React Query, Toast wrapped around the app
- **Types** (`src/types.ts`): Shared TypeScript types including `SERVER` (dns server definition) and `Protocol`

### Backend (`src-tauri/src/`)

- **Commands** (`commands/`): Tauri IPC handlers — `set_dns`, `clear_dns`, `clear_dns_cache`, `test_doh_server`, `get_interface_dns_info`, `get_interfaces`, `get_best_interface`, `change_interface_state`
- **DNS module** (`dns/`): `DnsServer` runs a local UDP proxy on `127.0.0.2:53` that forwards queries to DoH servers via Hickory DNS. Supports graceful shutdown via tokio channels
- **Network interfaces** (`net_interfaces/`): Uses WMI COM + Windows IP Helper API (`winapi` crate) to query and configure network adapters
- **App state** (`lib.rs`): `AppState` holds `DnsServer`, managed via `Mutex`. On exit, DNS settings are automatically cleared and the DoH proxy shuts down
- **Lib name**: `better_dns_jumper_lib` (due to Windows cargo naming constraint)

### Key Patterns

- **State management**: Zustand for UI state, React Query for server/async state with 10s refetch intervals, `tauri-plugin-store` for persistence
- **DNS protocols**: Traditional DNS (IPv4 addresses) and DoH (HTTPS URLs). DoT/DoQ/DoH3 are type-defined but not yet fully implemented
- **Server validation** (`src/components/ServerModal.tsx`): Per-protocol validation — IPv4 regex for DNS, HTTPS URL for DoH, domain for DoT, etc.
- **Tauri plugins**: autostart, store (persistence), updater, window-state, single-instance, prevent-default (context menu), log
- **Logging**: `tauri-plugin-log` writes to `%TEMP%/better-dns-jumper/`, 10MB max, filtered to `better_dns_jumper_lib` target only
