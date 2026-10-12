---
title: Interfacing an IR Sensor with ROS 2
summary: Wiring notes and a small Arduino test sketch for reading an IR obstacle sensor before adding ROS 2.
parent: robotic-arm-control-imu
---

## Connection diagram

| IR sensor pin | NodeMCU pin |
| --- | --- |
| VCC | 5V |
| GND | GND |
| OUT | 18 |

> **Check the board and sensor before wiring.** The original notes mix NodeMCU/ESP8266 pin names with an ESP32 GPIO 18 example, and list both 3.3V and 5V power. Use the pin map and voltage supported by your exact board and sensor.

## Arduino code for IR (test code, without ROS)

This sketch reads an IR obstacle sensor, debounces changes, controls the built-in LED, and reports state changes over Serial.

```cpp
/*
To use this code, wire your IR obstacle sensor to the ESP8266.
- VCC on the IR sensor goes to 3V3 (or Vin/5V if your sensor is 5V tolerant) on the ESP8266.
- GND on the IR sensor goes to GND on the ESP8266.
- OUT (Data) on the IR sensor goes to D5 (GPIO14) on the ESP8266.

If your sensor is Active-HIGH (outputs HIGH when an obstacle is detected), change:
#define ACTIVE_LOW false
*/

// Simple ESP32 IR Obstacle Sensor Code
#define LED_PIN 2           // Built-in LED on most ESP32 boards
#define IR_SENSOR_PIN 18    // IR sensor OUT pin connected to GPIO18

// Change this based on your sensor:
// true = sensor outputs LOW when obstacle detected (most common)
// false = sensor outputs HIGH when obstacle detected
#define ACTIVE_LOW true

bool lastSensorState = HIGH;
unsigned long lastDebounceTime = 0;
const unsigned long debounceDelay = 50;

void setup() {
    Serial.begin(115200);
    delay(1000);
    Serial.println("ESP32 IR Sensor - Serial Working");

    pinMode(IR_SENSOR_PIN, INPUT);
    pinMode(LED_PIN, OUTPUT);
    digitalWrite(LED_PIN, LOW);

    Serial.println("IR Sensor initialized on GPIO" + String(IR_SENSOR_PIN));
    Serial.println("Active LOW: " + String(ACTIVE_LOW ? "Yes" : "No"));
    Serial.println("Ready!");
}

void loop() {
    int sensorReading = digitalRead(IR_SENSOR_PIN);
    bool obstacleDetected = ACTIVE_LOW ? sensorReading == LOW : sensorReading == HIGH;

    if (sensorReading != lastSensorState) {
        lastDebounceTime = millis();
    }

    if ((millis() - lastDebounceTime) > debounceDelay) {
        digitalWrite(LED_PIN, obstacleDetected ? HIGH : LOW);

        static bool lastObstacleState = false;
        if (obstacleDetected != lastObstacleState) {
            Serial.println(obstacleDetected ? "🚨 OBSTACLE DETECTED!" : "✓ Path clear");
            lastObstacleState = obstacleDetected;
        }
    }

    lastSensorState = sensorReading;
    delay(10);
}
```

## References

- [Interfacing IR Sensor Module with Arduino](https://circuitdigest.com/microcontroller-projects/interfacing-ir-sensor-module-with-arduino)
- [IR sensor with NodeMCU (ESP8266)](https://techatronic.com/ir-sensor/)
- [Parent project guide](/writing/robotic-arm-control-imu/)
