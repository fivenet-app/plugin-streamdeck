# FiveNet for StreamDeck

StreamDeck plugin for FiveM servers with FiveNet integration.

> **Notice:** FiveNet for StreamDeck is a **community project** in the `fivenet-app` organization and is **not directly supported by the FiveNet team**. See `NOTICE` for details.

## Installation

1. Download the latest `.streamDeckPlugin` file from the [Releases](https://github.com/fivenet/plugin-streamdeck/releases) section.
2. Open the file, the StreamDeck application imports the plugin automatically.
3. Place the action keys on your device and log in via the **Login** key.

## Requirements

- Windows 10/11 or macOS 12+
- StreamDeck software 7.1+
- A FiveNet-compatible FiveM server (with account credentials)

## Actions

| Action | Description |
|---|---|
| Login | Log in to the server and choose a character |
| Open Dispatches | Count of open dispatches |
| Dispatch Status Display | Status of the accepted dispatch |
| Set Dispatch Status | Set the status of the accepted dispatch |
| Accept/Decline Dispatch | Accept or decline an assigned dispatch |
| Set Unit Status | Set the status of your own unit |
| Unit Status Display | Display the current status of your own unit |
| Join Unit | Join a unit |
| Notifications | Count of unread notifications |

## Building from source

1. Clone the repository: `git clone https://github.com/fivenet/plugin-streamdeck.git`
2. Install the dependencies: `npm install`
3. Build the plugin: `npm run build`
4. The built plugin lands in `com.fivenet.streamdeck-plugin.sdPlugin/`.

For live development use `npm run watch` (rebuilds and restarts the plugin in the Stream Deck app) and `npm run logs` (tails the plugin log). To install the built plugin manually, copy the `com.fivenet.streamdeck-plugin.sdPlugin` folder into your Stream Deck `Plugins` directory:

- Windows: `%APPDATA%\Elgato\StreamDeck\Plugins`
- macOS: `~/Library/Application Support/com.elgato.StreamDeck/Plugins`

### Nix / direnv (optional)

A [flake.nix](flake.nix) dev shell with Node.js 22 and pnpm is provided. Enter it with `nix develop` or — if [direnv](https://direnv.net) is installed — simply by `cd`ing into the directory (see [.envrc](.envrc)).

## License

Code is licensed under the Apache 2.0 license; see [LICENSE](LICENSE).

## Acknowledgements

- [@PhilTec-Philip](https://github.com/PhilTec-Philip) for creating and developing the community project.
- [@lelAdri](https://github.com/lelAdri) for this brilliant idea.
- The FiveNet team and Alexander Trost for the excellent open-source system that made this plugin possible.