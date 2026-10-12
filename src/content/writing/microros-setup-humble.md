---
title: micro-ROS Setup (ROS 2 Humble)
summary: Set up a micro-ROS agent on a ROS 2 Humble PC and flash an ESP32 with IMU, IR sensor, and rotary-encoder code.
parent: robotic-arm-control-imu
---

This guide covers micro-ROS setup on a ROS 2 Humble PC and sensor code for an ESP32.

## Hardware requirements

- ESP32 development board
- MPU6050 IMU sensor (I2C)
- Digital IR sensor
- Rotary encoder
- Connecting wires

## Code files

Download the files in this guide. The Arduino sketch uses placeholder WiFi credentials; add your own locally before uploading.

- [Setup instructions (Markdown)](/downloads/microros/MICROROS_SETUP_INSTRUCTIONS_HUMBLE.md)
- [Workspace setup script](/downloads/microros/setup_microros_workspace_humble.sh)
- [ESP32 sensor sketch](/downloads/microros/microros_esp32_sensors_humble.ino)

## Wiring connections

### MPU6050 (I2C)

- VCC → 3.3V
- GND → GND
- SDA → GPIO 21 (default I2C SDA)
- SCL → GPIO 22 (default I2C SCL)

### IR sensor

- VCC → 3.3V or 5V (depending on sensor)
- GND → GND
- OUT → GPIO 25

### Rotary encoder

- VCC → 3.3V
- GND → GND
- CLK (A) → GPIO 26
- DT (B) → GPIO 27

## PC setup (ROS 2 Humble)

### Step 1: Run the setup script

From the directory where you saved the script:

```sh
chmod +x setup_microros_workspace_humble.sh
./setup_microros_workspace_humble.sh
```

### Step 2: Start the micro-ROS agent

Open a terminal and run:

```sh
cd ~/microros_ws
source install/local_setup.bash
ros2 run micro_ros_agent micro_ros_agent udp4 --port 8888
```

Keep this terminal running while the ESP32 is operating.

## Arduino setup (ESP32)

### Step 1: Install Arduino IDE

Download Arduino IDE from [arduino.cc](https://www.arduino.cc/en/software).

### Step 2: Install ESP32 board support

- Open Arduino IDE.
- Go to **File → Preferences**.
- Add this URL to **Additional Board Manager URLs**:

```text
https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
```

- Go to **Tools → Board → Boards Manager**.
- Search for `esp32` and install **ESP32 by Espressif Systems**.

### Step 3: Install required libraries

In **Tools → Manage Libraries**, install:

- `micro_ros_arduino` — search for `micro_ros_arduino` and install the latest version.
- `MPU6050` by Electronic Cats.
- `I2Cdevlib`, if the dependency was not installed automatically.

### Step 4: Configure the code

Open `microros_esp32_sensors_humble.ino` and set:

- **WiFi credentials** — replace `YOUR_WIFI_SSID` and `YOUR_WIFI_PASSWORD` locally.
- **ROS 2 agent IP** — replace the sample address with your PC's LAN IP. On Linux, the original notes use:

  ```sh
  ip addr show | grep inet
  ```

- **Pin definitions** — adjust the IR and encoder pins if your wiring differs:

  ```cpp
  #define IR_SENSOR_PIN 25
  #define ENCODER_PIN_A 26
  #define ENCODER_PIN_B 27
  ```

### Step 5: Upload to ESP32

- Connect the ESP32 over USB.
- Select **Tools → Board → ESP32 Arduino → ESP32 Dev Module** (or your specific board).
- Select the ESP32 under **Tools → Port**.
- Click **Upload**.

## Testing

### Step 1: Monitor serial output

Open Serial Monitor at **115200 baud** and check the MPU6050, WiFi, and micro-ROS initialization messages.

### Step 2: Verify ROS 2 topics

In a new terminal:

```sh
source /opt/ros/humble/setup.bash
ros2 topic list
```

The sketch publishes:

- `/imu/data`
- `/ir_sensor/data`
- `/encoder/position`

### Step 3: View sensor data

```sh
ros2 topic echo /imu/data
ros2 topic echo /ir_sensor/data
ros2 topic echo /encoder/position
```

## Troubleshooting

### ESP32 won't connect to WiFi

- Double-check the SSID and password.
- Ensure the network is 2.4 GHz; ESP32 does not support 5 GHz WiFi.
- Check WiFi signal strength.

### micro-ROS connection fails

- Verify the PC IP address.
- Ensure the micro-ROS agent is running.
- Check firewall settings and allow UDP port 8888.
- Ensure the ESP32 and PC are on the same network.

### MPU6050 is not detected

- Check the I2C wiring (SDA and SCL).
- Try swapping SDA and SCL if it is still not detected.
- Verify the 3.3V supply.

### Encoder does not count

- Check pull-up resistors; the code enables internal pull-ups.
- Verify GPIO 26 and GPIO 27 wiring.
- Test the encoder by rotating it.

### No topics are visible in ROS 2

- Ensure the micro-ROS agent is running.
- Check the ESP32 serial output for errors.
- Verify network connectivity.
- Restart the agent and the ESP32.

## Publishing rate

The code publishes all sensor data at **100 Hz** (every 10 ms). Change `timer_timeout` in the sketch to change the interval:

```cpp
const unsigned int timer_timeout = 10;  // milliseconds
```

## Additional notes

- IMU data is converted to standard ROS units: m/s² for acceleration and rad/s for angular velocity.
- The encoder tracks relative position (positive or negative).
- The IR sensor returns true/false (HIGH/LOW).
- All topics publish simultaneously at the same rate.

## Next steps

- Create a ROS 2 node to process the sensor data.
- Record data with `ros2 bag record`.
- Visualize IMU data in RViz2.
- Build robot-control systems using this sensor feedback.

[Back to the project overview →](/writing/robotic-arm-control-imu/)
