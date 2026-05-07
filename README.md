# MQTT-MANAGER

MQTT broker setup for managing generator, admin, and Raspberry Pi GPS clients using Eclipse Mosquitto and Docker.

## Overview

This repository contains:

- A production-style Mosquitto broker setup in `mqtt-broker/`
- ACL-based user permissions
- Password-based authentication
- Example publisher/subscriber clients
- WebSocket support for MQTT clients

Current active users:

- `generator-client` (writes generator topics)
- `admin` (full access)
- `rpi-1` (reads/writes `gps/#`)
- `rpi-2` (reads/writes `gps/#`)

## Project Structure

```text
MQTT-WEMOR/
  README.md
  mqtt-broker/
    docker-compose.yml
    mosquitto/
      config/
      data/
      log/
      certs/
    scripts/
    backend/
    mobile/
    web/
```

## Quick Start

### 1) Go to broker folder

```bash
cd mqtt-broker
```

### 2) Create/update user passwords

```bash
bash scripts/create-password-file.sh generator-client "<GENERATOR_PASS>"
bash scripts/create-password-file.sh admin "<ADMIN_PASS>"
bash scripts/create-password-file.sh rpi-1 pass rpi-2 pass
```

### 3) Start broker

```bash
docker compose up -d
```

### 4) Verify logs

```bash
docker compose logs -f mosquitto
```

## Connection Endpoints

- MQTT TCP: `mqtt://localhost:1883`
- MQTT over WebSocket: `ws://localhost:9001`

If connecting from another device, replace `localhost` with your PC LAN IP (for example `192.168.1.10`).

## MQTTX Example Connections

### Generator client

- Host: `localhost`
- Port: `1883`
- Username: `generator-client`
- Password: `<GENERATOR_PASS>`
- Client ID: `generator-client`

Publish example:

- Topic: `vitals/generator/sim-01`
- Payload:

```json
{"hr":78,"spo2":98}
```

### RPi clients

For each Raspberry Pi user (`rpi-1` / `rpi-2`):

- Host: `localhost`
- Port: `1883`
- Username: `rpi-1` (or `rpi-2`)
- Password: `pass`
- Client ID: `rpi-1` (or `rpi-2`)

Allowed topics:

- `gps/#` (read and write)

### Admin client

- Host: `localhost`
- Port: `1883`
- Username: `admin`
- Password: `<ADMIN_PASS>`
- Client ID: `admin-client`

Admin has full read/write permissions on all topics.

## ACL Summary

Configured in `mqtt-broker/mosquitto/config/aclfile`:

- `generator-client` -> `write vitals/generator/#`, `readwrite vitals/control/#`
- `admin` -> `readwrite #`
- `rpi-1` -> `readwrite gps/#`
- `rpi-2` -> `readwrite gps/#`

## Security Notes

- Do not commit real secrets.
- Use strong passwords for `generator-client` and `admin`.
- Rotate credentials regularly.
- Use TLS in production environments.

## Useful Commands

Restart broker after ACL/password changes:

```bash
docker compose restart mosquitto
```

Check running containers:

```bash
docker ps
```

## License

Add your preferred license file (MIT, Apache-2.0, etc.) if this project is public.
