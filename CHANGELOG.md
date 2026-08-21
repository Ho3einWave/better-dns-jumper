# Changelog

All notable changes to this project are documented here.

## [0.5.1] - 2026-08-21

Fixes for regressions in 0.5.0, all found on real hardware.

### Fixed

- **Auto-detect chose a tunnel adapter instead of Wi-Fi.** Interface detection
  probed IPv6 before IPv4. A machine with no native IPv6 still has Teredo / 6to4 /
  ISATAP pseudo-adapters, and Windows returns a route to a global IPv6 address
  through one of them, so the wrong adapter was reported. IPv4 is probed first now,
  and the result is validated against the adapter list — anything down, disabled,
  loopback or a tunnel is rejected.
- **The activation toggle snapped back to off.** It was reconciled against "is the
  proxy applied", which plain DNS never sets — it writes the chosen server's own
  addresses onto the adapter — so the switch was forced off the instant it was
  switched on. Reconciliation now only ever forces the switch *on*, when the proxy
  really is applied; the rest is settled by the commands themselves.
- **Turning off plain DNS left the servers in place, and Reset did nothing.** Both
  go through the same restore, which verified only that the proxy address was gone.
  For plain DNS that was true immediately, so the check passed without anything
  having been restored. Verification now snapshots what is configured beforehand and
  waits for those specific addresses to disappear.
- **`127.0.0.2` survived closing the app.** The restore existed in two separate
  implementations, and only the one behind the toggle had recovery logic. The exit
  handler and the startup sweep shared the other one, which tried a single method
  and gave up — so closing the app left the proxy address applied and reopening did
  not repair it. Both paths now use one shared implementation.

### Changed

- Reverting DNS escalates through three mechanisms rather than trusting one:
  `SetInterfaceDnsSettings` with a null `NameServer`, the same call with an empty
  string, then WMI. A null pointer appears to be ignored on some systems even with
  the corresponding flag set, returning success while changing nothing.
- The adapter chosen by Auto is logged at info, so the log answers "which interface
  did it pick" without needing to reproduce anything.
- Every commit now produces a downloadable executable from CI, and the build is
  checked on Windows before a tag is cut rather than at release time.

[0.5.1]: https://github.com/Ho3einWave/better-dns-jumper/releases/tag/v0.5.1

## [0.5.0] - 2026-08-18

### Fixed

- **`127.0.0.2` stayed applied after closing the app, leaving no working internet.**
  `DNS_SETTING_NAMESERVER` was defined as `0x1000` instead of `0x0002`.
  `SetInterfaceDnsSettings` only applies fields whose flag bit is set, so the exit
  cleanup was a silent no-op that still reported success — the address was never cleared,
  neither on close nor by the next launch's recovery sweep.
- **The app failed to launch after saving a custom DNS rule.** Rule loading called
  `Handle::block_on` from inside a tokio context, which panics. A fresh install started
  fine and died on the next launch once a rule existed.
- **IPv6 DNS leak.** WMI's `SetDNSServerSearchOrder` is IPv4-only, so a dual-stack
  machine kept querying its ISP's IPv6 resolver while the app claimed to be protecting
  it. IPv6 name servers are now redirected to the proxy on Windows 10 1903 and newer.
- **Truncated DNS responses failed.** The proxy listened on UDP only, so the mandatory
  TCP retry hit a closed port. It now listens on TCP as well, on both loopback addresses.
- **Failed connect and disconnect were silent.** Neither mutation had an error handler,
  so a failure produced no message while the toggle still flipped — the UI showed
  "connected" when the adapter had not changed.
- **The toggle could disagree with reality.** It is now reconciled against the adapter's
  actual DNS servers instead of being a purely optimistic local flag.
- Interface auto-detection used an IPv4-only probe against a hardcoded address, so it
  chose the wrong adapter on IPv6-only networks.

### Added

- **Application log viewer** with search, level filters, a live toggle, copy, and a link
  to the log folder.
- **Instant network change detection** via `NotifyIpInterfaceChange`, replacing the
  fixed-interval poll. Plugging in a cable or switching Wi-Fi now updates the UI
  immediately.
- Adapter enable/disable through SetupAPI, the mechanism Device Manager uses.
- Support for Windows 10 builds older than 1903 (including LTSC 2019). Previously the
  binary would not load at all on those versions.

### Changed

- Replaced WMI with the Win32 IP Helper API for DNS configuration and interface
  enumeration. Two full-table WMI scans per poll became a single syscall. WMI remains
  only as the DNS fallback on Windows 10 builds before 1903.
- Replaced the unmaintained `winapi` crate with Microsoft's `windows` crate.
- Typed errors across the IPC boundary, so failures name the operation and carry their
  own context. Windows failures now include the system's own description.
- Logs go to a single rotating file, `%TEMP%\better-dns-jumper\better-dns-jumper.log`
  (5 MB, 3 kept), in a parseable format. Previously the same lines were also written to
  `%LOCALAPPDATA%`, and frontend logs never reached the file at all.
- Documented minimum is now Windows 10. Earlier documentation claiming Windows 7 was
  incorrect: the Rust standard library links Windows 8 and 10 APIs into every binary
  built for the default target.

[0.5.0]: https://github.com/Ho3einWave/better-dns-jumper/releases/tag/v0.5.0
