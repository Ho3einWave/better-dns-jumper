# Better DNS Jumper

A modern, cross-platform DNS management tool built with Tauri (Rust + React). Easily switch between DNS servers, manage network interfaces, and use DNS-over-HTTPS (DoH) with a beautiful, intuitive interface.

## Features

### Current Features

- **Multiple DNS Protocol Support**
  - Traditional DNS servers (IPv4)
  - DNS-over-HTTPS (DoH) with local proxy server

- **Network Interface Management**
  - View all network interfaces
  - Auto-detect best network interface
  - Set DNS servers per interface
  - Clear DNS settings

- **DNS Server Management**
  - Pre-configured popular DNS servers (Google, Cloudflare, Quad9, AdGuard, etc.)
  - Custom DNS server support
  - DoH server testing with latency measurement
  - Server availability indicators

- **Additional Tools**
  - Clear DNS cache
  - Reset DNS settings
  - Auto-start on system boot
  - Automatic updates

- **User Interface**
  - Modern, dark-themed UI built with React and HeroUI
  - Smooth animations with Framer Motion


## Installation

### Prerequisites

- Windows 10/11 (currently Windows-only)
- Administrator privileges (required for DNS changes)

### Download

Download the latest release from the [Releases](https://github.com/Ho3einWave/better-dns-jumper/releases) page.

### Build from Source

1. **Install Prerequisites**
   - [Rust](https://www.rust-lang.org/tools/install) (latest stable)
   - [Node.js](https://nodejs.org/) (v18 or later) or [Bun](https://bun.sh/)
   - [Tauri CLI](https://tauri.app/v1/guides/getting-started/prerequisites)

2. **Clone the Repository**
   ```bash
   git clone https://github.com/Ho3einWave/better-dns-jumper.git
   cd better-dns-jumper
   ```

3. **Install Dependencies**
   ```bash
   # Using npm
   npm install
   
   # Or using bun
   bun install
   ```

4. **Run in Development Mode**
   ```bash
   npm run tauri dev
   # Or
   bun run tauri dev
   ```

5. **Build for Production**
   ```bash
   npm run tauri build
   # Or
   bun run tauri build
   ```

## Usage

1. **Launch the Application**
   - Run `better-dns-jumper.exe` (requires administrator privileges)
   - The application will start minimized or in the system tray

2. **Select Network Interface**
   - Choose "Auto" to automatically detect the best interface
   - Or select a specific network interface from the dropdown

3. **Choose DNS Protocol**
   - Switch between "DNS" (traditional) and "DoH" (DNS-over-HTTPS) tabs

4. **Select DNS Server**
   - Pick from the list of available DNS servers
   - For DoH servers, latency is automatically tested and displayed

5. **Activate DNS**
   - Click the toggle button to apply DNS settings
   - The interface will show the current DNS configuration

6. **Additional Actions**
   - **Clear DNS Cache**: Clears the Windows DNS resolver cache
   - **Reset DNS**: Removes custom DNS settings and restores defaults
   - **Test DoH Server**: Manually test a DoH server's availability

## Technical Details

### Architecture

- **Frontend**: React 19 + TypeScript + Vite
- **UI Framework**: HeroUI + TailwindCSS
- **Backend**: Rust with Tauri 2.0
- **DNS Library**: Hickory DNS (hickory-resolver, hickory-server)
- **Network Management**: Windows API (IP Helper API) + WMI

### How It Works

1. **Traditional DNS**: Directly sets DNS servers on the selected network interface using Windows WMI
2. **DoH (DNS-over-HTTPS)**: 
   - Starts a local UDP DNS server on `127.0.0.2`
   - Proxies DNS queries to the selected DoH server
   - Sets the network interface to use the local proxy server

### Project Structure

```
better-dns-jumper/
├── src/                    # React frontend
│   ├── components/        # UI components
│   ├── screens/           # Main application screens
│   ├── hooks/             # React hooks
│   ├── stores/            # Zustand state management
│   └── constants/         # Constants and configurations
├── src-tauri/             # Rust backend
│   ├── src/
│   │   ├── commands/      # Tauri command handlers
│   │   ├── dns/           # DNS server implementation
│   │   └── net_interfaces/ # Network interface management
│   └── Cargo.toml
└── package.json
```

## Roadmap

### Planned Features

- [ ] **Improve Error Handling**
  - Better error messages and user feedback
  - Graceful error recovery
  - Error logging and reporting

- [ ] **Clean up on Exit**
  - Properly restore DNS settings on application exit
  - Clean shutdown of DNS proxy server
  - Resource cleanup

- [ ] **Better Logs**
  - Structured logging
  - Log file rotation
  - Log viewer in UI
  - Debug mode

- [ ] **DNS-over-TLS (DoT)**
  - Support for DoT protocol
  - DoT server configuration
  - DoT server testing

- [ ] **DNS-over-QUIC (DoQ)**
  - Support for DoQ protocol
  - DoQ server configuration
  - DoQ server testing

- [ ] **DNS-over-HTTP/3 (DoH3)**
  - Support for HTTP/3-based DoH
  - Improved performance over DoH
  - HTTP/3 server testing

- [ ] **Less Dependent on WMI**
  - Migrate to native Windows API (Windows 8+)
  - Reduce WMI dependency for better performance
  - More reliable DNS management

- [ ] **CLI Interface**
  - Command-line interface for power users
  - Script-friendly DNS management
  - Integration with automation tools

- [ ] **Multi-language Support**
  - Internationalization (i18n)
  - Multiple language packs
  - Language switcher in settings

- [ ] **Cloud Sync and Profiles**
  - Sync DNS profiles across devices
  - Custom profile management
  - Profile import/export
  - Cloud storage integration

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with [Tauri](https://tauri.app/)
- DNS functionality powered by [Hickory DNS](https://github.com/hickory-dns/hickory-dns)
- UI components from [HeroUI](https://heroui.com/)

## Support

If you encounter any issues or have questions, please open an issue on [GitHub](https://github.com/Ho3einWave/better-dns-jumper/issues).
