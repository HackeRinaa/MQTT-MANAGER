/*
  Browser-side WebSocket example.
  Works in a bundler/browser environment where `mqtt` package is available.

  npm i mqtt
*/

import mqtt from "mqtt";

const url = import.meta?.env?.VITE_MQTT_WS_URL || "wss://localhost:9001";
const username = import.meta?.env?.VITE_MQTT_USER || "backend-consumer";
const password = import.meta?.env?.VITE_MQTT_PASS || "change-me";

const client = mqtt.connect(url, {
  username,
  password,
  clientId: `wemore-web-${Math.random().toString(16).slice(2, 8)}`,
  reconnectPeriod: 2000,
});

client.on("connect", () => {
  console.log("[mqtt-web] connected");
  client.subscribe(["vitals/generator/+", "vitals/hmd/+", "mobile/location/+"], {
    qos: 1,
  });
});

client.on("message", (topic, payloadBuffer) => {
  const payload = payloadBuffer.toString("utf8");
  console.log("[mqtt-web] message", topic, payload);
});

client.on("error", (err) => {
  console.error("[mqtt-web] error", err.message);
});
// Browser example using MQTT.js over secure WebSockets.
// Install in web project: npm i mqtt
import mqtt from "mqtt";

const client = mqtt.connect("ws://localhost:8084", {
  username: "toc-web",
  password: "change-web-pass",
  clientId: `toc-web-${Math.random().toString(16).slice(2, 8)}`,
  protocolVersion: 5,
  clean: true,
  reconnectPeriod: 2000,
  connectTimeout: 10000,
});

client.on("connect", () => {
  console.log("[web] connected");
  client.subscribe("vitals/control/#", { qos: 1 });
  client.subscribe("gps/#", { qos: 0 });
  client.subscribe("vitals/#", { qos: 1 });
});

client.on("message", (topic, payload) => {
  console.log("[web] topic:", topic, "payload-bytes:", payload.length);
});

client.on("error", (error) => {
  console.error("[web] mqtt error", error);
});
