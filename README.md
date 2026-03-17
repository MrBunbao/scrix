# Scrix

Camera stream discovery for [Scrypted NVR](https://www.scrypted.app/).

Scrix is a fork of [Strix](https://github.com/eduard256/Strix) that replaces Frigate config generation with direct Scrypted NVR integration. It discovers working camera streams (RTSP, HTTP, MJPEG, ONVIF) across 67,000+ models from 3,600+ brands, then pushes them straight into Scrypted as configured cameras.

## Quick Start

### 1. Run with Docker Compose

```bash
git clone https://github.com/MrBunbao/scrix.git
cd scrix
docker compose up -d
```

Open **http://YOUR_SERVER_IP:4567**

### 2. Install the Scrypted Plugin

In the Scrypted management console:

1. Go to **Plugins** and install the **Scrix** plugin from NPM (`@scrypted/scrix`)
2. Open the Scrix plugin settings
3. Set the **Scrix Server URL** to `http://<scrix-host>:4567`
4. Click **Save**

### 3. Discover and Add Cameras

1. Open the Scrix web UI
2. Enter camera IP, credentials, and optional model
3. Click **Discover Streams** -- working streams appear in 30-60 seconds
4. Click **Add to Scrypted** on any discovered stream
5. The camera appears in Scrypted, ready for NVR recording and detection

## Configuration

Persistent config is stored in `/config` inside the container (mapped to the `scrix-config` Docker volume).

| Environment Variable | Default | Description |
|---|---|---|
| `SCRIX_LOG_LEVEL` | `info` | Log level (debug, info, warn, error) |
| `SCRIX_CONFIG_PATH` | `/config` | Path for persistent config |
| `SCRIX_API_LISTEN` | `:4567` | Listen address |

## Design

See [docs/superpowers/plans/](docs/superpowers/plans/) for the full implementation design spec.

## License

MIT -- see [LICENSE](LICENSE).
