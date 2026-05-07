/*
  Example mobile location publisher.

  Run:
    npm i mqtt
    MQTT_URL=mqtt://localhost:1883 MQTT_USER=mobile-client MQTT_PASS=secret DEVICE_ID=user-001 node mobile/mobile-example.js
*/

const mqtt = require("mqtt");

const mqttUrl = process.env.MQTT_URL || "mqtt://localhost:1883";
const username = process.env.MQTT_USER || "mobile-client";
const password = process.env.MQTT_PASS || "change-me";
const deviceId = process.env.DEVICE_ID || "user-001";
const topic = `mobile/location/${deviceId}`;

const client = mqtt.connect(mqttUrl, {
  username,
  password,
  clientId: `wemore-mobile-${deviceId}`,
});

client.on("connect", () => {
  console.log(`[mqtt] connected. publishing to ${topic}`);

  setInterval(() => {
    const message = {
      userId: deviceId,
      lat: 37.9838 + (Math.random() - 0.5) * 0.002,
      lon: 23.7275 + (Math.random() - 0.5) * 0.002,
      accuracyMeters: Math.round(4 + Math.random() * 10),
      speedMps: Number((Math.random() * 1.5).toFixed(2)),
      ts: new Date().toISOString(),
    };

    client.publish(topic, JSON.stringify(message), { qos: 1 }, (err) => {
      if (err) {
        console.error("[mqtt] publish error:", err.message);
      } else {
        console.log("[mqtt] sent:", message);
      }
    });
  }, 5000);
});

client.on("error", (err) => {
  console.error("[mqtt] error:", err.message);
});
// Mobile app pattern (React Native / Capacitor style JS).
// Use mqtt package with WebSocket transport:
// npm i mqtt
import mqtt from "mqtt";

const personnelId = "personnel-42";

const client = mqtt.connect("ws://localhost:8084", {
  username: "mobile-app",
  password: "change-mobile-pass",
  clientId: `mobile-${personnelId}`,
  protocolVersion: 5,
  clean: false,
  reconnectPeriod: 3000,
});

client.on("connect", () => {
  client.subscribe("vitals/control/#", { qos: 1 });
});

export function publishLocationBinary(locationBytes) {
  client.publish(
    `gps/${personnelId}`,
    locationBytes,
    {
      qos: 1,
      retain: false,
      properties: {
        contentType: "application/octet-stream",
        userProperties: {
          ts: String(Date.now()),
          deviceId: personnelId,
          unitId: "n/a",
          msgType: "location",
          codec: "raw-binary-v1",
        },
      },
    }
  );
}
