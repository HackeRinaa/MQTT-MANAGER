# Integration Report: Generator + HMD + Mobile -> MQTT -> Web App

This report explains exactly what changed in the new MQTT broker workspace and what must be changed in the generator and web app codebases.

## A. New broker delivered

### Stack

- Broker: Eclipse Mosquitto `2.1.2`
- Runtime: Docker Compose
- Ports:
  - `1883` MQTT (TCP)
  - `8883` MQTT over TLS
  - `9001` MQTT over WebSocket (for browser clients)

### Auth and authorization model

- `allow_anonymous false`
- Password-based auth through `mosquitto/config/passwords`
- ACL-based topic permissions in `mosquitto/config/aclfile`

### Topic routing model

- Synthetic/external generator vital signs:
  - Topic: `vitals/generator/{sourceId}`
  - Writer account: `generator-client`
- Real HMD vital signs:
  - Topic: `vitals/hmd/{deviceId}`
  - Writer account: `hmd-client`
- Mobile user location:
  - Topic: `mobile/location/{userId}`
  - Writer account: `mobile-client`
- Backend/web consumers:
  - Subscribe to `vitals/#` and `mobile/location/#`
  - Reader account: `backend-consumer`

## B. Changes required in generator codebase

The generator codebase must publish to this broker instead of its current output destination.

### 1) Add MQTT dependency

- Node.js: `npm i mqtt`
- Python: `pip install paho-mqtt` (if generator is Python)

### 2) Add broker env variables in generator project

Required:

- `MQTT_URL` (e.g. `mqtt://<broker-host>:1883` or `mqtts://<broker-host>:8883`)
- `MQTT_USER=generator-client`
- `MQTT_PASS=<generator-password>`
- `MQTT_SOURCE_ID=<unique-generator-id>`

Optional:

- `MQTT_QOS=1`
- `MQTT_RETAIN=false`

### 3) Publish format and topic

- Topic template: `vitals/generator/${MQTT_SOURCE_ID}`
- Payload must be JSON and include at least:
  - `source` (`generator`)
  - `sourceId`
  - `hr` (heart rate)
  - `spo2`
  - `rr`
  - `ts` (ISO timestamp)

Example payload:

```json
{
  "source": "generator",
  "sourceId": "sim-01",
  "hr": 74,
  "spo2": 98,
  "rr": 16,
  "ts": "2026-05-06T13:01:45.233Z"
}
```

### 4) Delivery semantics

- Use QoS `1` for at-least-once delivery.
- Keep retained messages disabled unless you explicitly need the latest state replay.
- Reconnect automatically on connection loss (client reconnect interval 1-2s).

### 5) Validation command

From broker workspace, run subscriber:

- `node backend/nodejs-subscriber.js`

Then start generator publisher and verify incoming messages on:

- `vitals/generator/{sourceId}`

## C. Changes required in HMD ingestion/publisher

If HMD data is published directly by device gateway/service:

- Use `MQTT_USER=hmd-client`
- Publish to `vitals/hmd/{deviceId}`
- Use QoS `1`
- Include timestamp and device identifier in payload

Recommended minimum payload fields:

- `source` (`hmd`)
- `deviceId`
- `hr`
- `spo2`
- `rr`
- `ts`

## D. Changes required in mobile app/backend

### Mobile app publisher

- Use `MQTT_USER=mobile-client`
- Publish to `mobile/location/{userId}`
- Suggested fields:
  - `userId`
  - `lat`
  - `lon`
  - `accuracyMeters`
  - `speedMps`
  - `ts`

### Web/backend consumer

- Use `MQTT_USER=backend-consumer`
- Subscribe to:
  - `vitals/generator/+`
  - `vitals/hmd/+`
  - `mobile/location/+`
- Normalize message envelope into shared DTO before storing/pushing to UI.

## E. Changes required in this current workspace env

In this workspace (the one consuming data), add/update env values to point to the new broker:

- `MQTT_URL=mqtt://<broker-host>:1883` (or `mqtts://<broker-host>:8883`)
- `MQTT_WS_URL=wss://<broker-host>:9001` (if browser connects directly)
- `MQTT_USER=backend-consumer`
- `MQTT_PASS=<backend-consumer-password>`

If TLS is used with self-signed certificates in Node services, configure CA trust explicitly.

## F. Operational checklist

- [ ] `docker compose up -d` succeeds
- [ ] Mosquitto healthcheck passes
- [ ] Generator publishes and backend receives
- [ ] HMD publishes and backend receives
- [ ] Mobile publishes and backend receives
- [ ] WebSocket consumer receives on `9001`
- [ ] Credentials rotated from defaults
- [ ] Password file and `.env` not committed

## G. Optional bridge support

If external generator already writes to another broker, you can bridge it:

1. Copy `mosquitto/config/conf.d/bridge-remote-gateway.example.conf` to
   `bridge-remote-gateway.conf`
2. Set remote host and credentials
3. Restart Mosquitto

This lets your local broker ingest external topics without changing generator code immediately.
