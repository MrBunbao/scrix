# Scrix

Camera stream discovery for [Scrypted NVR](https://www.scrypted.app/).

Scrix is a fork of [Strix](https://github.com/eduard256/Strix) that replaces Frigate config generation with direct Scrypted NVR integration. It discovers working camera streams (RTSP, HTTP, MJPEG, ONVIF) across 67,000+ models from 3,600+ brands, then pushes them straight into Scrypted as configured cameras ready for recording and object detection.

## How It Works

Scrix has two components:

1. **Scrix Container** -- Docker container running the stream discovery engine and web UI
2. **Scrypted Plugin** (`scrypted-scrix`) -- thin plugin inside Scrypted that receives discovered cameras

The web UI discovers streams, and when you click "Add to Scrypted", the camera is created in Scrypted with NVR recording and object detection automatically enabled.

## Quick Start

### 1. Install the Scrypted Plugin

Deploy the plugin to your Scrypted instance:

```bash
cd scrypted-plugin
npm install
npm run build
# Using curl (bypasses TLS issues with self-signed certs):
curl -sk -u 'USERNAME' 'https://SCRYPTED_IP:10443/login'
# Save the token, then:
curl -sk -X POST -u 'USERNAME:TOKEN' -H 'Content-Type: application/json' \
  -d @package.json 'https://SCRYPTED_IP:10443/web/component/script/setup?npmPackage=scrypted-scrix'
curl -sk -X POST -u 'USERNAME:TOKEN' -H 'Content-Type: application/zip' \
  --data-binary @out/plugin.zip 'https://SCRYPTED_IP:10443/web/component/script/deploy?npmPackage=scrypted-scrix'
```

Open the plugin in Scrypted and copy the **API Key** from its settings.

### 2. Run the Scrix Container

```yaml
# docker-compose.yml
services:
  scrix:
    image: scrix/scrix:latest
    container_name: scrix
    volumes:
      - scrix-config:/config
    environment:
      - SCRIX_LOG_LEVEL=info
    restart: unless-stopped
    network_mode: host

volumes:
  scrix-config:
```

```bash
docker compose up -d
```

### 3. Configure Connection

Open **http://YOUR_SERVER_IP:4567**, click the gear icon, and enter:

- **Scrypted Host URL**: `https://SCRYPTED_IP:10443`
- **API Key**: paste the key from the plugin settings
- Click **Test Connection** to verify

### 4. Discover and Add Cameras

1. Enter a camera IP address and optional credentials
2. Click **Discover Streams** -- working streams appear in seconds
3. Select a main stream (and optional sub stream)
4. Configure NVR recording and object detection options
5. Click **Add to Scrypted**
6. The camera appears in Scrypted NVR immediately

## Building from Source

### Docker Image

```bash
# For the same platform:
docker build -t scrix/scrix:latest .

# Cross-compile for AMD64 (e.g., building on Mac for a Linux NAS):
docker buildx build --platform linux/amd64 -t scrix/scrix:latest --load .
```

### Scrypted Plugin

```bash
cd scrypted-plugin
npm install
npm run build          # dev build (out/plugin.zip)
NODE_ENV=production npm run build  # production build (dist/plugin.zip)
```

## Configuration

| Environment Variable | Default | Description |
|---|---|---|
| `SCRIX_LOG_LEVEL` | `info` | Log level: debug, info, warn, error |
| `SCRIX_CONFIG_PATH` | `/config` | Persistent config directory |

## Camera Database

Scrix inherits Strix's camera database:

- **67,288** camera models
- **3,636** brands
- **102,787** URL patterns
- **5 protocols**: RTSP, HTTP MJPEG, JPEG, BUBBLE, ONVIF

## License

MIT
