/*
  Real HMD device publisher example.

  Run:
    npm i mqtt
    MQTT_URL=mqtt://localhost:1883 MQTT_USER=hmd-client MQTT_PASS=secret DEVICE_ID=hmd-01 node backend/hmd-publisher-example.js
*/

const mqtt = require("mqtt");

const mqttUrl = process.env.MQTT_URL || "mqtt://localhost:1883";
const username = process.env.MQTT_USER || "hmd-client";
const password = process.env.MQTT_PASS || "change-me";
const deviceId = process.env.DEVICE_ID || "hmd-01";
const topic = `vitals/hmd/${deviceId}`;

const client = mqtt.connect(mqttUrl, {
  username,
  password,
  clientId: `hmd-${deviceId}`,
});

client.on("connect", () => {
  console.log(`[mqtt] connected. publishing to ${topic}`);

  setInterval(() => {
    const msg = {
      source: "hmd",
      deviceId,
      hr: Math.round(58 + Math.random() * 30),
      spo2: Math.round(92 + Math.random() * 7),
      rr: Math.round(11 + Math.random() * 11),
      accel: {
        x: Number((Math.random() * 0.2 - 0.1).toFixed(3)),
        y: Number((Math.random() * 0.2 - 0.1).toFixed(3)),
        z: Number((1 + Math.random() * 0.2 - 0.1).toFixed(3)),
      },
      ts: new Date().toISOString(),
    };

    client.publish(topic, JSON.stringify(msg), { qos: 1 }, (err) => {
      if (err) {
        console.error("[mqtt] publish error:", err.message);
      } else {
        console.log("[mqtt] sent:", msg);
      }
    });
  }, 2000);
});

client.on("error", (err) => {
  console.error("[mqtt] error:", err.message);
});
