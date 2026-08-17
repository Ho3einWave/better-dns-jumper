# Plan: move DNS configuration and interface enumeration off WMI

**Status:** ready to implement
**Scope:** Phases 1–2 only. Adapter enable/disable stays on WMI. The 10s React Query poll stays (replacing it with `NotifyIpInterfaceChange` is a separate follow-up).
**Bindings:** migrate from `winapi` 0.3.9 + hand-written `extern "system"` blocks to the Microsoft-generated `windows` crate.

---

## 1. Why

### 1.1 The headline bug: `SetDNSServerSearchOrder` is IPv4-only → DNS leak

`src-tauri/src/dns/dns_utils.rs:49` applies DNS via WMI:

```rust
wmi_con.exec_instance_method::<InterfaceInfoWmi, _>(path, "SetDNSServerSearchOrder", params)
```

`Win32_NetworkAdapterConfiguration.SetDNSServerSearchOrder` does not support IPv6 — Microsoft documents it as IPv4-only. So on activation the app sets the **IPv4** DNS to `127.0.0.2` and leaves the **IPv6** DNS pointing at whatever the router advertised via RDNSS/DHCPv6.

On a dual-stack connection Windows will send queries to the ISP's IPv6 resolver, unencrypted, completely bypassing the DoH proxy. For a DNS privacy tool this is the worst class of failure: it is silent, and the UI reports success.

This is the primary reason for the migration. Everything else is secondary.

### 1.2 The 10s poll is expensive

`get_interface_dns_info` (`src-tauri/src/dns/dns_utils.rs:11`) fans out to **three** WMI queries, two of them unfiltered full-table scans:

```
get_interface_dns_info(idx)
├── general::get_interface_by_index(idx) → get_all_interfaces()
│   ├── SELECT * FROM Win32_NetworkAdapter WHERE NetEnabled = TRUE OR NetEnabled = FALSE
│   └── SELECT * FROM Win32_NetworkAdapterConfiguration          ← no WHERE clause
└── SELECT * FROM Win32_NetworkAdapterConfiguration WHERE InterfaceIndex = idx
```

`src/hooks/useDns.ts:58` runs this every 10 seconds via `refetchInterval`, forever, to read **one** field (`dns_server_search_order`). Each round trip talks to `WmiPrvSE.exe`.

`GetAdaptersAddresses` returns everything all three queries provide, in one call, with no COM.

### 1.3 `COMLibrary::assume_initialized()` is unsound

`src-tauri/src/utils/mod.rs:20` asserts COM is already initialized on the calling thread. Tauri runs commands on pool/worker threads that never called `CoInitializeEx`. It works today by luck, not by contract.

### 1.4 Hand-written bindings caused two real bugs

Both were found in `src-tauri/src/utils/mod.rs` and are already fixed on `main`, but they show the failure mode:

- `DNS_SETTING_NAMESERVER` was `0x1000`; the real value is `0x0002`. `SetInterfaceDnsSettings` only applies fields whose flag bit is set, so the exit cleanup was a **silent no-op** — it returned `0` (success) and did nothing. Users were left with `127.0.0.2` and no working internet after closing the app.
- `EnableLLMNR` / `QueryAdapterName` were typed `u64`; they are `ULONG` in `netioapi.h`. That pushed `ProfileNameServer` 8 bytes past its real offset.

Neither is expressible with `windows-rs`, because the structs and constants are generated from Windows metadata. **This is the main argument for the crate swap — do not hand-roll any new `extern "system"` blocks in this work.**

---

## 2. Dependencies

`windows` 0.61.3 and 0.62.2 are already in `src-tauri/Cargo.lock` (pulled in by Tauri), so using either adds no new compile cost. Use **0.62**.

```toml
# src-tauri/Cargo.toml
windows = { version = "0.62", features = [
    "Win32_Foundation",
    "Win32_NetworkManagement_IpHelper",
    "Win32_NetworkManagement_Ndis",
    "Win32_Networking_WinSock",
] }
```

**Remove `winapi` entirely.** After this work its only remaining users are `GetBestInterface` (moves to `windows`) and the DNS helpers (rewritten). Confirm with `grep -rn winapi src-tauri/src` before deleting the dependency.

**Keep `wmi`** — still used by adapter enable/disable.

> **API signatures:** windows-rs adjusts signatures between versions (`Option<>` wrappers on optional pointers, `WIN32_ERROR` vs `u32` returns, module reshuffles). Every signature quoted below is indicative. **Verify each against the actual crate** with rust-analyzer or `cargo doc -p windows --open` rather than copying verbatim.

---

## 3. Phase 1 — DNS set / clear / read via IP Helper

### 3.1 New module layout

`src-tauri/src/utils/mod.rs` is already carrying too much. Split the Win32 code out:

```
src-tauri/src/win/
├── mod.rs           // re-exports
├── adapters.rs      // GetAdaptersAddresses wrapper, sockaddr → IpAddr, interface enumeration
└── dns_settings.rs  // Get/SetInterfaceDnsSettings, index → LUID → GUID
```

`src-tauri/src/utils/mod.rs` keeps only `create_wmi_connection` and `ipv4_to_u32`.

### 3.2 `win/dns_settings.rs`

Types from `windows::Win32::NetworkManagement::IpHelper`: `DNS_INTERFACE_SETTINGS`, `SetInterfaceDnsSettings`, `GetInterfaceDnsSettings`, `FreeInterfaceDnsSettings`, `DNS_SETTING_NAMESERVER`, `DNS_SETTING_IPV6`, `DNS_INTERFACE_SETTINGS_VERSION1`, `ConvertInterfaceIndexToLuid`, `ConvertInterfaceLuidToGuid`. `NET_LUID_LH` is in `Win32::NetworkManagement::Ndis`. `GUID` / `PCWSTR` are in `windows::core`.

```rust
#[derive(Clone, Copy, PartialEq)]
pub enum Family { V4, V6 }

/// interface index → adapter GUID
pub fn interface_guid(if_index: u32) -> Result<GUID, String>;

/// Reads the configured name servers for one address family.
pub fn get_interface_dns(if_index: u32, family: Family) -> Result<Vec<IpAddr>, String>;

/// Sets the name server list for one address family.
/// `servers` empty → reverts that family to the DHCP-provided servers.
pub fn set_interface_dns(if_index: u32, family: Family, servers: &[IpAddr]) -> Result<(), String>;
```

Implementation notes:

- The adapter GUID is **not** per-family. Convert once from `IfIndex`; the `DNS_SETTING_IPV6` flag selects which family the call operates on. (If an adapter has no IPv4 and `IfIndex` is 0, fall back to `Ipv6IfIndex`.)
- `Flags` for V4 is `DNS_SETTING_NAMESERVER`; for V6 it is `DNS_SETTING_NAMESERVER | DNS_SETTING_IPV6`.
- `NameServer` is a **comma-separated** list of addresses as a wide string (e.g. `L"1.1.1.1,1.0.0.1"`). Build a `Vec<u16>` with a trailing NUL and pass `PCWSTR(v.as_ptr())`. Keep the `Vec` alive across the call.
  - ⚠️ **Verify the separator empirically** on the first Windows build — round-trip through `GetInterfaceDnsSettings` and cross-check with `Get-DnsClientServerAddress`. Comma is what WireGuard's Windows client uses, but confirm rather than assume.
- To clear: `NameServer` = `PCWSTR::null()` with `DNS_SETTING_NAMESERVER` set. This reverts the family to DHCP.
- `GetInterfaceDnsSettings` allocates; **you must call `FreeInterfaceDnsSettings`** on the returned struct. Wrap it in a guard so early returns can't leak.
- `Version` must be `DNS_INTERFACE_SETTINGS_VERSION1` for both calls.

### 3.3 Close the IPv6 leak

The proxy currently binds IPv4 only (`dns_server.rs:307`, `127.0.0.2:53`), so pointing IPv6 DNS at it is not yet possible. Two changes:

**a) Bind the proxy on IPv6 loopback too** — `src-tauri/src/dns/dns_server.rs`

In `DnsServer::run`, after registering the existing `127.0.0.2:53` socket, also try `[::1]:53` and register it on the **same** `ServerFuture`:

```rust
let ipv6_ready = match UdpSocket::bind("[::1]:53").await {
    Ok(sock) => { server.register_socket(sock); true }
    Err(e) => { warn!("Could not bind [::1]:53, IPv6 DNS will not be redirected: {}", e); false }
};
```

`DnsServer::run` must return this flag (change the return type to `Result<ProxyBinding, String>` or return `bool`) so `set_dns` knows whether it is safe to point IPv6 DNS at `::1`.

**b) Set both families** — `src-tauri/src/commands/dns.rs`, `set_dns`

For the encrypted protocols (`doh` / `dot` / `doq` / `doh3`):

1. Set V4 name servers to `[127.0.0.2]`.
2. Read the current V6 name servers.
3. Filter out Windows' **default site-local anycast** addresses `fec0:0:0:ffff::1`, `fec0:0:0:ffff::2`, `fec0:0:0:ffff::3`. These are present on many systems by default and do **not** indicate real configured IPv6 DNS. This filter is essential — without it the leak check misfires on almost every machine.
4. If the filtered list is non-empty **and** `ipv6_ready`, set V6 name servers to `[::1]`.
5. If the filtered list is non-empty and `!ipv6_ready`, leave V6 alone and surface a warning — do not point DNS at a socket that isn't listening.

For plain `dns`: partition the user's `dns_servers` list by address family and set each family with its own list. If the list has no IPv6 entries, leave V6 untouched and log — plain-DNS mode cannot fully close the leak, which is a known limitation worth documenting in the README.

**c) Clear both families** — `clear_dns` and `clear_stale_doh_dns`

`clear_stale_doh_dns` (`src-tauri/src/utils/mod.rs`) currently scans only for IPv4 `127.0.0.2`. It must also detect `::1` in the IPv6 DNS list and revert that family, otherwise this work introduces a *new* stale-state bug on IPv6 that strands users exactly the way the old flag bug did.

Both loopback constants belong in one place:

```rust
pub const PROXY_V4: Ipv4Addr = Ipv4Addr::new(127, 0, 0, 2);
pub const PROXY_V6: Ipv6Addr = Ipv6Addr::LOCALHOST; // ::1
```

### 3.4 Fix the clear ordering bug

`src-tauri/src/commands/dns.rs:165-178` currently does:

```rust
app_state.dns_server.shutdown().await?;          // proxy dies first
let result = dns_utils::clear_dns_by_path(path); // then restore
```

If the restore fails, the proxy is already gone and system DNS still points at a dead `127.0.0.2` — instant total DNS outage. **Invert it:** restore DNS first, verify, then shut the proxy down. If the restore errors, fall back to `clear_stale_doh_dns()` before returning.

### 3.5 Rewrite `dns_utils.rs`

Replace `apply_dns_by_path`, `clear_dns_by_path`, and the DNS-reading half of `get_interface_dns_info` with calls into `win::dns_settings`. `clear_dns_cache` (`DnsFlushResolverCache`) stays as-is but should move to the `win` module for consistency.

**After this phase `src-tauri/src/dns/dns_utils.rs` must contain zero WMI calls.** That is the acceptance test for Phase 1.

---

## 4. Phase 2 — interface enumeration via `GetAdaptersAddresses`

### 4.1 `win/adapters.rs`

```rust
pub fn list_interfaces() -> Result<Vec<NetworkInterface>, String>;
pub fn best_interface_index() -> Result<u32, String>;
/// Maps the frontend's `0` ("Auto") sentinel to the real best-interface index.
pub fn resolve_interface_index(idx: u32) -> Result<u32, String>;
```

Flags for `GetAdaptersAddresses`, family `AF_UNSPEC`:

| Flag | Value | Why |
|---|---|---|
| `GAA_FLAG_SKIP_ANYCAST` | `0x0002` | not needed |
| `GAA_FLAG_SKIP_MULTICAST` | `0x0004` | not needed |
| `GAA_FLAG_INCLUDE_GATEWAYS` | `0x0080` | gateway list |
| `GAA_FLAG_INCLUDE_ALL_INTERFACES` | `0x0100` | matches today's `NetEnabled = TRUE OR FALSE` |

Do **not** set `GAA_FLAG_SKIP_UNICAST` (IP addresses are needed) or `GAA_FLAG_SKIP_DNS_SERVER`.

The existing `get_adapters_addresses()` helper in `src-tauri/src/utils/mod.rs` already has the correct retry-and-alignment pattern (15KB initial buffer, retry on `ERROR_BUFFER_OVERFLOW`, `Vec<u64>` backing for 8-byte alignment). **Port that logic, don't rewrite it** — reverting to a `Vec<u8>` buffer or a single sizing call would reintroduce fixed bugs.

### 4.2 Field mapping

The frontend consumes only **six** of the ~30 fields currently returned (verified by grep):

| Current (`useInterfaces.ts`) | Source | Notes |
|---|---|---|
| `adapter.interface_index` | `IfIndex` | |
| `adapter.name` | `FriendlyName` | "Wi-Fi", "Ethernet" |
| `adapter.description` | `Description` | hardware string |
| `adapter.net_enabled` | `OperStatus == IfOperStatusUp (1)` | |
| `config.ip_address` | `FirstUnicastAddress` walk | |
| `adapter.config_manager_error_code` | ⚠️ see below | |

`config_manager_error_code` (used at `src/screens/NetworkInterfaces.tsx:107` as `=== 22` for the "Disabled" badge) is a device-manager property with no IP Helper equivalent. Use `MIB_IF_ROW2.AdminStatus == NET_IF_ADMIN_STATUS_DOWN (2)` instead — call `GetIfTable2` **once** and join by interface index, not `GetIfEntry2` per adapter. This preserves the badge's meaning (administratively disabled) as distinct from `OperStatus` down (cable unplugged).

Proposed flat replacement type — drop the WMI-shaped `{ adapter, config }` nesting:

```rust
#[derive(Serialize)]
pub struct NetworkInterface {
    pub interface_index: u32,       // IfIndex
    pub ipv6_interface_index: u32,  // Ipv6IfIndex
    pub guid: String,               // AdapterName
    pub name: String,               // FriendlyName
    pub description: String,        // Description
    pub mac_address: Option<String>,// PhysicalAddress[..PhysicalAddressLength]
    pub if_type: u32,               // IfType — drives the existing icon logic
    pub is_up: bool,                // OperStatus == 1
    pub is_admin_disabled: bool,    // from GetIfTable2
    pub dhcp_enabled: bool,         // Flags & IP_ADAPTER_DHCP_ENABLED
    pub ip_addresses: Vec<String>,
    pub gateways: Vec<String>,
    pub dns_servers: Vec<String>,
}
```

Check `src/utils/interface.tsx` — the existing icon logic keys off description/name string matching and may map more cleanly onto `if_type` (`IF_TYPE_IEEE80211 = 71`, `IF_TYPE_ETHERNET_CSMACD = 6`, `IF_TYPE_TUNNEL = 131`, `IF_TYPE_SOFTWARE_LOOPBACK = 24`).

### 4.3 `sockaddr_to_ip` helper

Needed in three places (unicast, gateway, DNS server walks):

```rust
unsafe fn sockaddr_to_ip(sa: *const SOCKADDR) -> Option<IpAddr>
```

- `AF_INET` → cast to `SOCKADDR_IN`, read `sin_addr.S_un.S_addr` (network byte order) → `Ipv4Addr::from(u32::from_be(x))`
- `AF_INET6` → cast to `SOCKADDR_IN6`, read `sin6_addr.u.Byte` → `Ipv6Addr::from([u8; 16])`
- anything else → `None`

This replaces the open-coded `(sa as *const u8).add(4)` pointer arithmetic currently in `clear_stale_doh_dns`.

### 4.4 Delete from `net_interfaces/general.rs`

Remove: `get_all_interfaces`, `get_interface_by_index`, `NetworkAdapterConfigurationWmi`, `Interface`, and the `winapi` `GetBestInterface` block (moves to `win/adapters.rs`).

Keep: `get_network_adapter_path_by_ifidx` and `change_interface_state`, plus the `NetworkAdapterWmi` struct they need. These are the only remaining WMI users.

### 4.5 Fix the COM initialization

With WMI reduced to enable/disable — a rare, user-initiated action — replace `COMLibrary::assume_initialized()` with a correct per-thread init. Run the enable/disable call on a dedicated blocking thread (`tauri::async_runtime::spawn_blocking`) that creates a `COMLibrary` via `COMLibrary::new()`. The `COMLibrary` guard must outlive the `WMIConnection` — hold both in the same scope.

### 4.6 Fix `get_best_interface`

`src-tauri/src/commands/net_interfaces.rs:19` returns `()` and only calls `dbg!`, while `src/hooks/useInterfaces.ts:20` invokes it expecting an `Interface`. Either make it return `Result<NetworkInterface, String>` or delete both it and `useBestInterface`. Check whether anything renders `useBestInterface` before deleting.

Also replace the `dbg!` calls in `get_interfaces` with proper `log::error!`.

---

## 5. IPC signature changes

Dropping WMI removes `__Path`, which is a WMI-only artifact. Switch the commands to interface index:

| Command | Before | After |
|---|---|---|
| `set_dns` | `path: String, ...` | `interface_index: u32, ...` |
| `clear_dns` | `path: String` | `interface_index: u32` |
| `get_interface_dns_info` | returns `{ ..., path }` | returns `{ interface_index, interface_name, dns_servers }` |

This also fixes a latent frontend bug: `src/screens/main.tsx:239` passes `interfaceDnsInfo?.path ?? ""`, so if the query hasn't resolved yet the app sends an empty path and the WMI call fails silently. The index is already known locally (`IfIdx` state), so no such race exists.

Every command taking an index must run it through `resolve_interface_index` to handle the `0` = "Auto" sentinel — the same mapping `get_interface_dns_info` already does at `src-tauri/src/commands/dns.rs:121-126`. Centralize it; do not duplicate.

### Frontend files to update

- `src/hooks/useInterfaces.ts` — replace the `Interface` type with the flat shape
- `src/hooks/useDns.ts` — `path` → `interface_index` in `useSetDns` / `useClearDns`; drop `path` from `InterfaceDnsInfo`
- `src/screens/main.tsx` — `handleSetDns` / `handleClearDns` / `handleResetDns` pass `IfIdx`; the `isDisabled={!interfaceDnsInfo?.path}` guards at lines 307, 337, 414 need a new condition (`!interfaceDnsInfo` works)
- `src/screens/NetworkInterfaces.tsx` — field renames, `config_manager_error_code === 22` → `is_admin_disabled`
- `src/utils/interface.tsx` — optionally switch icon selection to `if_type`

---

## 6. Verification

**None of this compiles on Linux** — `winapi`, `wmi`, and `windows` all stub out to empty crates off-target, so `cargo check` fails on pre-existing imports across the whole crate. It must be built and tested on Windows (or via the existing `.github/workflows/release.yml` runner).

Manual test matrix, all on a **dual-stack** connection (a machine with only IPv4 will not exercise the leak fix):

1. **IPv6 leak closed.** `Get-DnsClientServerAddress` (PowerShell — shows both families cleanly, unlike `ipconfig /all`) before and after activating a DoH server. Both `AddressFamily` rows for the active interface must point at the proxy (`127.0.0.2` / `::1`).
2. **Resolution works.** `nslookup example.com 127.0.0.2` and `nslookup example.com ::1` both answer. Check `DnsActivity` logs the queries.
3. **Clean toggle-off.** Deactivate → `Get-DnsClientServerAddress` shows the original DHCP servers for **both** families.
4. **Clean exit.** Activate, close via the titlebar X → DNS restored for both families.
5. **Dirty exit.** Activate, kill from Task Manager → relaunch → startup recovery (`lib.rs:105`) restores both families. Confirm the new verification log line from `clear_stale_doh_dns` reports success.
6. **No WMI on the hot path.** Open Task Manager, watch `WmiPrvSE.exe` while the app idles on the main screen for a minute. It should show no periodic activity — the 10s poll must no longer touch WMI. (This is the clearest signal Phase 2 landed correctly.)
7. **Enable/disable still works.** Toggle an adapter off and on from the Network Interfaces screen — this is the one path still on WMI, and section 4.5 changes how COM is initialized for it.
8. **Plain DNS unaffected.** Activate a plain-DNS server, confirm IPv4 DNS matches the selection.

---

## 7. Out of scope (worth filing as follow-ups)

- **`NotifyIpInterfaceChange`** to replace the 10s poll with push events. Once Phase 2 lands the poll is cheap, but event-driven would also make the UI react to a Wi-Fi switch instantly instead of up to 10s later.
- **SetupAPI** (`SetupDiSetClassInstallParams` + `DICS_ENABLE`/`DICS_DISABLE`) to remove the last WMI usage and restore a true `config_manager_error_code`.
- **TCP listener on the proxy.** `dns_server.rs` registers only UDP sockets. A truncated response makes the client retry over TCP against a port with nothing listening, so the query fails. Add `register_listener` with a `TcpListener` on both `127.0.0.2:53` and `[::1]:53`.
- **`GetBestInterfaceEx`** instead of `GetBestInterface` — the latter is IPv4-only and takes a hardcoded `8.8.8.8` destination (`net_interfaces/general.rs:12`).
- **OS floor.** `Set/GetInterfaceDnsSettings` are Windows 10 1809+. The static import means older Windows fails to *load the .exe* at all. Either document 1809+ as the minimum in the README, or resolve the symbols via `GetProcAddress`.
- **Optimistic toggle state.** `src/screens/main.tsx:244` flips `isActive` regardless of whether the mutation succeeded, and never reconciles it against the actual adapter DNS. If a clear fails, the UI shows "off" while the proxy address is still applied — the user then closes the app believing they already disconnected. Derive `isActive` from `interfaceDnsInfo.dns_servers`.

---

## 8. Definition of done

- [ ] `grep -rn "winapi" src-tauri/` returns nothing; the dependency is removed from `Cargo.toml`
- [ ] `grep -rn "wmi\|WMI" src-tauri/src/dns/` returns nothing
- [ ] The only remaining WMI calls are `change_interface_state` and `get_network_adapter_path_by_ifidx`
- [ ] No `extern "system"` blocks remain in the codebase — every Win32 call goes through `windows-rs`
- [ ] `COMLibrary::assume_initialized()` is gone
- [ ] Test matrix items 1–8 pass on a dual-stack Windows machine
