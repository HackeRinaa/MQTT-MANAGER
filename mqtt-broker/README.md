# WEMORE MQTT Broker (Eclipse Mosquitto 2.1.2)

This folder is a standalone MQTT broker project for:

- External generator vital-sign stream
- Real HMD vital-sign stream
- Mobile location stream
- Backend/web app consumers

It is isolated under `mqtt-broker` so you can open it as a separate workspace.

## 1) What is included

- `docker-compose.yml`: Mosquitto container pinned to `eclipse-mosquitto:2.1.2`
- `mosquitto/config/mosquitto.conf`: main broker config
- `mosquitto/config/aclfile`: topic permissions per client type
- `scripts/generate-certs.sh`: create self-signed TLS certs
- `scripts/create-password-file.sh`: create/update Mosquitto password file
- `backend/nodejs-subscriber.js`: backend subscriber example

## 2) Topic contract

- Generator writes: `vitals/generator/{sourceId}`
- HMD writes: `vitals/hmd/{deviceId}`
- Mobile writes: `mobile/location/{userId}`
- Backend/Web consume:
  - `vitals/generator/+`
  - `vitals/hmd/+`
  - `mobile/location/+`

## 3) Quick start

1. Copy env file:

   - `cp .env.example .env`

2. Generate TLS certs:

   - `bash scripts/generate-certs.sh`

3. Create passwords:

   - `bash scripts/create-password-file.sh generator-client "<password>"`
   - `bash scripts/create-password-file.sh admin "<password>"`

4. Start broker:

   - `docker compose up -d`

5. Validate:

   - `docker compose logs -f mosquitto`

## 4) Local client usage

Install dependency once in any local test folder:

- `npm i mqtt`

Run subscriber client:

- Backend subscriber: `node backend/nodejs-subscriber.js`

Each script can be configured with environment variables:

- `MQTT_URL` (example: `mqtt://localhost:1883` or `mqtts://localhost:8883`)
- `MQTT_USER`
- `MQTT_PASS`
- `DEVICE_ID` or `SOURCE_ID` where relevant

## 5) Security notes

- Anonymous access is disabled.
- ACLs enforce write/read access by role.
- TLS listeners are enabled on `8883` and `9001`.
- Keep real secrets in `.env` and `mosquitto/config/passwords` (both git-ignored).
# Production MQTT Infrastructure (Mosquitto 2.1.2)

This package is a standalone MQTT broker module you can copy into any repository.

It is designed for:

- HMD and mobile-originated data
- constrained links (BLE + LoRaWAN)
- secure cloud ingestion
- backend stream processing
- web/mobile consumers over MQTT over WebSockets

## 1) Architecture Fit

Data path:

`HMD / Mobile App -> BLE -> Local Gateway -> LoRaWAN -> MQTT Broker -> Backend -> Web & Mobile Apps`

Deployment model (local-first):

- Local broker endpoint: `mqtt://localhost:1883`
- Local WebSocket endpoint for browser/mobile JS clients: `ws://localhost:8084`
- Optional: later switch to cloud DNS (example `c8.satways.cloud`)

## 2) Directory Layout

```text
mqtt-broker/
  docker-compose.yml
  .env.example
  mosquitto/
    config/
      mosquitto.conf
      aclfile
      passwords.example
    data/
    log/
    certs/
  scripts/
    generate-certs.sh
    create-password-file.sh
  backend/
    nodejs-subscriber.js
  web/
```

## 3) Quick Start

1. Copy this `mqtt-broker` folder into any repo.
2. Create runtime files:
   - `cp .env.example .env`
   - `cp mosquitto/config/passwords.example mosquitto/config/passwords`
3. Generate TLS certificates (dev/self-hosted CA):
   - `bash scripts/generate-certs.sh`
4. Create credential hashes:
   - `bash scripts/create-password-file.sh`
5. Start broker:
   - `docker compose up -d`

## 4) Mosquitto Configuration (2.1.2)

The full broker config is in `mosquitto/config/mosquitto.conf` with:

- TLS listener (`8883`) for device/backend traffic
- Secure WebSocket listener (`8084`) for web/mobile apps
- username/password auth and ACL enforcement
- durable sessions and persistence
- disk-backed retained/offline delivery
- structured logs to file + stdout
- explicit safety limits for payload and queues

## 5) Topic Design (Simple and Explicit)

Core topic set:

- `vitals/#` -> vital sign generator stream
- `tqb_processing.2.app.vitals.topic` -> HMHD device stream
- `vitals/control/#` -> control actions (alert create/resolve/ack)
- `gps/{personnelId}` -> personnel GPS location

Examples:

- `vitals/generator-a`
- `vitals/generator-a/patient-1001`
- `tqb_processing.2.app.vitals.topic`
- `vitals/control/alert/create`
- `vitals/control/alert/resolve`
- `gps/personnel-42`

Naming conventions:

- lowercase only
- keep topic names short (LoRa bandwidth efficiency)
- publish to concrete topics only (subscribers use wildcards)
- reserve `vitals/control/#` for trusted control publishers

## 6) QoS and Retain Policy

| Topic class | QoS | Retain | Reason |
|---|---:|---:|---|
| vitals/# | 1 | No | reliable at-least-once delivery for medical data |
| tqb_processing.2.app.vitals.topic | 1 | No | dedicated HMHD ingest topic |
| gps/{personnelId} | 0 or 1 | No | QoS 0 for frequent updates, QoS 1 if sparse/critical |
| vitals/control/# | 1 (or 2 if mission-critical) | Yes for active alert state only | ensure operators receive latest active control state |

Retain best practice:

- Retain only active control state in `vitals/control/#` when needed.
- Do **not** retain raw vitals or GPS streams.
- Clear retained control state by publishing empty payload with retain flag.

## 7) Payload Handling (Binary + Metadata)

### Recommended transport mode

- **Device/Gateway -> Broker:** raw binary payload for minimum LoRa overhead.
- **Web/mobile generated payloads:** JSON with base64 payload for compatibility.

### Canonical envelope for backend decoding

Use MQTT v5 User Properties when possible, otherwise prepend a tiny header or use JSON metadata topic pairs.

Minimum metadata required by backend:

- `ts`: source timestamp (ms epoch)
- `deviceId`
- `unitId`
- `msgType`
- `codec`: `raw-binary-v1` / `base64-json-v1`
- `contentType`: `application/octet-stream`
- `correlationId` (optional but recommended)

Binary options:

1. **Raw payload preferred**  
   Publish binary bytes directly. Metadata carried in MQTT v5 properties.
2. **Base64 in JSON (fallback)**  
   For clients that cannot send raw binary.

JSON fallback example:

```json
{
  "ts": 1770000012345,
  "deviceId": "app-42",
  "unitId": "n/a",
  "msgType": "location",
  "codec": "base64-json-v1",
  "payloadB64": "AAECAwQFBgc=",
  "meta": {
    "gpsFix": 3,
    "hdop": 1.1
  }
}
```

## 8) Backend Integration (Node.js + MQTT.js)

See `backend/nodejs-subscriber.js`.

Pipeline:

1. Subscribe wildcard:
   - `vitals/#`
   - `tqb_processing.2.app.vitals.topic`
   - `vitals/control/#`
   - `gps/#`
2. Parse by simple prefix:
   - `vitals/*` -> vitals parser
   - exact `tqb_processing.2.app.vitals.topic` -> HMHD parser
   - `vitals/control/*` -> control parser
   - `gps/*` -> location parser
3. Decode payload:
   - raw binary decoder by `msgType`, or
   - JSON->base64 fallback decoder.
4. Validate schema.
5. Persist to DB (time-series DB + operational DB).
6. Trigger event bus / websocket fanout.

Recommended DB split:

- telemetry: TimescaleDB/ClickHouse/Influx
- alerts/state: PostgreSQL
- hot cache: Redis

## 9) Web & Mobile Integration

### Web (TOC) over WebSockets

- endpoint: `ws://localhost:8084`
- protocol: MQTT over WS
- authenticate with least-privilege service user
- subscribe example:
  - `vitals/control/#`
  - `gps/#`
  - `vitals/#`

Use MQTTX or your own web client implementation for WebSocket testing.

### Mobile app behavior

- publish location:
  - `gps/{personnelId}`
- subscribe to alerts:
  - `vitals/control/#`
- use QoS 1 for alerts/location if sparse and important

Security:

- avoid embedding admin credentials in mobile/web
- use per-app-role users with ACL-restricted topic prefixes
- rotate credentials and certificates

## 10) Security Baseline

- TLS only (disable plaintext listener)
- CA-signed server cert in production
- per-client username/password and ACL
- unique client IDs (`cleanStart=false` for durable subscriptions)
- enforce topic write/read boundaries via `aclfile`
- max packet size + inflight/queue limits
- optional IP allow-list at firewall/LB level

## 11) Performance & Scaling Guidance

Given ~200 bytes every 30 seconds per device:

- 4 devices: very small load
- 5,000 devices: ~33 msg/s average (still moderate for Mosquitto)

Guidance:

- telemetry QoS 1, heartbeat QoS 0
- keep payload binary and compact
- batch at gateway where acceptable
- persistent sessions for intermittently connected subscribers
- tune `max_queued_messages`, `message_size_limit`, and OS file limits

Horizontal scaling patterns:

1. **Regional brokers + bridging to core broker** (recommended for LoRa geographies)
2. **Shared subscriptions** for backend consumers:
   - `$share/ingestors/vitals/#`
   - `$share/ingestors/gps/#`
3. **HA active-passive** with VIP/LB and replicated config/data volumes
4. For very large scale, evaluate EMQX/HiveMQ clustered tier while keeping same topic schema

## 12) High Availability Notes

Mosquitto itself is lightweight and robust, but not a multi-master cluster.

Production HA pattern:

- Two broker instances (primary/secondary)
- External TCP LB (health checks)
- Config managed via IaC + secret store
- Persistent volumes backed by durable storage
- Backup/restore of persistence DB + certs + ACL/password files

## 13) Deployment Notes

### Docker

- `docker-compose.yml` pins `eclipse-mosquitto:2.1.2`
- maps config/data/log/certs
- exposes `8883` and `8084`
- restart policy and healthcheck enabled

### Cloud

- terminate TLS either at broker (recommended here) or ingress/LB
- open only required ports
- for cloud, use DNS name in certificate SAN (example `c8.satways.cloud`)
- mount secrets from cloud secret manager, not Git

## 14) Optional Enhancements

- Remote gateway broker bridge (`connection ...` blocks in Mosquitto)
- Alert routing microservice:
  - subscribe `vitals/control/#`
  - push notifications / SMS / command center webhooks
- Monitoring:
  - ship logs to ELK/OpenSearch
  - scrape broker metrics via sidecar exporter (`mosquitto-exporter`)

## 15) Production Checklist

- [ ] CA-issued certs installed
- [ ] Passwords hashed and rotated
- [ ] ACL validated with negative tests
- [ ] Topic contracts versioned and documented
- [ ] Backup/restore tested
- [ ] Alerting on broker restarts, disconnect spikes, auth failures
- [ ] Load test with expected and burst traffic
