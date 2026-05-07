/*
  External generator publisher example.

  Run:
    npm i mqtt
    MQTT_URL=mqtt://localhost:1883 MQTT_USER=generator-client MQTT_PASS=secret SOURCE_ID=sim-01 node backend/generator-publisher-example.js
*/

const mqtt = require("mqtt");

const mqttUrl = process.env.MQTT_URL || "mqtt://localhost:1883";
const username = process.env.MQTT_USER || "generator-client";
const password = process.env.MQTT_PASS || "change-me";
const sourceId = process.env.SOURCE_ID || "sim-01";
const topic = `vitals/generator/${sourceId}`;

const client = mqtt.connect(mqttUrl, {
  username,
  password,
  clientId: `generator-${sourceId}`,
});

client.on("connect", () => {
  console.log(`[mqtt] connected. publishing to ${topic}`);

  setInterval(() => {
    const msg = {
      source: "generator",
      sourceId,
      hr: Math.round(65 + Math.random() * 15),
      spo2: Math.round(95 + Math.random() * 4),
      rr: Math.round(12 + Math.random() * 8),
      tempC: Number((36.3 + Math.random() * 1.2).toFixed(1)),
      ts: new Date().toISOString(),
    };

    client.publish(topic, JSON.stringify(msg), { qos: 1 }, (err) => {
      if (err) {
        console.error("[mqtt] publish error:", err.message);
      } else {
        console.log("[mqtt] sent:", msg);
      }
    });
  }, 3000);
});

client.on("error", (err) => {
  console.error("[mqtt] error:", err.message);
});
