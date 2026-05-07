/*
  Example backend consumer:
  - Subscribes to generator + HMD vitals and mobile location topics.
  - Prints normalized output to stdout.

  Run:
    npm i mqtt
    MQTT_URL=mqtt://localhost:1883 MQTT_USER=backend-consumer MQTT_PASS=secret node backend/nodejs-subscriber.js
*/

const mqtt = require("mqtt");

const mqttUrl = process.env.MQTT_URL || "mqtt://localhost:1883";
const username = process.env.MQTT_USER || "backend-consumer";
const password = process.env.MQTT_PASS || "change-me";
const clientId = process.env.MQTT_CLIENT_ID || "wemore-backend-consumer";

const client = mqtt.connect(mqttUrl, {
  username,
  password,
  clientId,
  reconnectPeriod: 2000,
});

const topics = ["vitals/generator/+", "vitals/hmd/+", "mobile/location/+"];

client.on("connect", () => {
  console.log(`[mqtt] connected to ${mqttUrl}`);
  client.subscribe(topics, { qos: 1 }, (err) => {
    if (err) {
      console.error("[mqtt] subscribe failed:", err.message);
      process.exitCode = 1;
      return;
    }
    console.log(`[mqtt] subscribed to: ${topics.join(", ")}`);
  });
});

client.on("message", (topic, payloadBuffer) => {
  const payload = payloadBuffer.toString("utf8");
  let parsed;
  try {
    parsed = JSON.parse(payload);
  } catch {
    parsed = { rawPayload: payload };
  }

  console.log(
    JSON.stringify(
      {
        topic,
        receivedAt: new Date().toISOString(),
        payload: parsed,
      },
      null,
      2
    )
  );
});

client.on("error", (err) => {
  console.error("[mqtt] error:", err.message);
});

client.on("reconnect", () => {
  console.log("[mqtt] reconnecting...");
});
/* eslint-disable no-console */
const fs = require("fs");
const mqtt = require("mqtt");

const brokerUrl = process.env.MQTT_URL || "mqtt://localhost:1883";
const username = process.env.MQTT_USERNAME || "backend-ingestor";
const password = process.env.MQTT_PASSWORD || "change-backend-pass";
const caPath = process.env.MQTT_CA_PATH || "../mosquitto/certs/ca.crt";

const client = mqtt.connect(brokerUrl, {
  username,
  password,
  clientId: `backend-ingestor-${Math.random().toString(16).slice(2, 10)}`,
  clean: false,
  reconnectPeriod: 2000,
  connectTimeout: 10_000,
  protocolVersion: 5,
  ...(brokerUrl.startsWith("mqtts://") ? { ca: fs.readFileSync(caPath) } : {}),
});

const TOPICS = ["vitals/#", "tqb_processing.2.app.vitals.topic", "vitals/control/#", "gps/#"];

client.on("connect", () => {
  console.log("[mqtt] connected");
  client.subscribe(
    TOPICS.map((topic) => ({ topic, qos: 1 })),
    (err) => {
      if (err) console.error("[mqtt] subscribe error:", err.message);
      else console.log("[mqtt] subscribed:", TOPICS.join(", "));
    }
  );
});

client.on("message", async (topic, payload, packet) => {
  try {
    const topicInfo = parseTopic(topic);
    const normalized = decodePayload(payload, packet, topicInfo);
    await persistMessage(normalized);
    console.log("[ingest]", normalized.topic, normalized.metadata.msgType);
  } catch (err) {
    console.error("[ingest] failed:", err.message, "topic:", topic);
  }
});

client.on("error", (err) => console.error("[mqtt] error:", err.message));
client.on("reconnect", () => console.log("[mqtt] reconnecting..."));

function parseTopic(topic) {
  if (topic === "tqb_processing.2.app.vitals.topic") {
    return { stream: "hmhd-vitals", msgType: "vitals" };
  }

  if (topic.startsWith("vitals/control/")) {
    return {
      stream: "vitals-control",
      msgType: "control",
      action: topic.replace("vitals/control/", "") || "unknown",
    };
  }

  if (topic.startsWith("vitals/")) {
    return {
      stream: "vitals",
      msgType: "vitals",
      source: topic.replace("vitals/", "") || "generator",
    };
  }

  if (topic.startsWith("gps/")) {
    return {
      stream: "gps",
      msgType: "location",
      personnelId: topic.replace("gps/", "") || "unknown",
    };
  }

  throw new Error("unexpected topic format");
}

function decodePayload(payload, packet, topicInfo) {
  const contentType = packet?.properties?.contentType;
  const userProperties = packet?.properties?.userProperties || {};

  // JSON fallback: {"payloadB64":"...","ts":...}
  if (contentType === "application/json") {
    const body = JSON.parse(payload.toString("utf8"));
    return {
      topic: topicInfo,
      metadata: {
        ts: body.ts || Date.now(),
        deviceId: body.deviceId || topicInfo.personnelId || topicInfo.source || "unknown",
        unitId: body.unitId || "unknown",
        msgType: body.msgType || topicInfo.msgType,
        codec: body.codec || "base64-json-v1",
      },
      payload: Buffer.from(body.payloadB64 || "", "base64"),
      raw: body,
    };
  }

  // Raw binary mode (preferred for gateways)
  return {
    topic: topicInfo,
    metadata: {
      ts: Number(userProperties.ts || Date.now()),
      deviceId: String(
        userProperties.deviceId || topicInfo.personnelId || topicInfo.source || "unknown"
      ),
      unitId: String(userProperties.unitId || "unknown"),
      msgType: String(userProperties.msgType || topicInfo.msgType),
      codec: String(userProperties.codec || "raw-binary-v1"),
    },
    payload,
    raw: null,
  };
}

async function persistMessage(doc) {
  // Replace this with your DB layer:
  // - telemetry -> time-series table
  // - alerts/status -> operational table
  // Example shape:
  // await db.insert("mqtt_messages", { ...doc, payload_hex: doc.payload.toString("hex") });
  return Promise.resolve();
}
