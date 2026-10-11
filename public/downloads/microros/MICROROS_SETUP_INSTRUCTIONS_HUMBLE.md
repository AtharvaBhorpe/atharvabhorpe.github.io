# micro-ROS ESP32 Sensor Setup Guide (ROS2 Humble)

This guide will help you set up micro-ROS on your ROS2 Humble PC and flash the ESP32 with sensor code.

## Hardware Requirements

- ESP32 development board
- MPU6050 IMU sensor (I2C)
- Digital IR sensor
- Rotary encoder
- Connecting wires

## Wiring Connections

### MPU6050 (I2C)
- VCC → 3.3V
- GND → GND
- SDA → GPIO 21 (default I2C SDA)
- SCL → GPIO 22 (default I2C SCL)

### IR Sensor
- VCC → 3.3V or 5V (depending on sensor)
- GND → GND
- OUT → GPIO 25

### Rotary Encoder
- VCC → 3.3V
- GND → GND
- CLK (A) → GPIO 26
- DT (B) → GPIO 27

## PC Setup (ROS2 Humble)

### Step 1: Run the setup script

```bash
chmod +x setup_microros_workspace_humble.sh
./setup_microros_workspace_humble.sh
```

### Step 2: Start the micro-ROS agent

Open a terminal and run:

```bash
cd ~/microros_ws
source install/local_setup.bash
ros2 run micro_ros_agent micro_ros_agent udp4 --port 8888
```

Keep this terminal running while your ESP32 is operating.

## Arduino Setup (ESP32)

### Step 1: Install Arduino IDE

Download from: https://www.arduino.cc/en/software

### Step 2: Install ESP32 board support

1. Open Arduino IDE
2. Go to File → Preferences
3. Add to "Additional Board Manager URLs":
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
4. Go to Tools → Board → Boards Manager
5. Search for "esp32" and install "ESP32 by Espressif Systems"

### Step 3: Install required libraries

Go to Tools → Manage Libraries and install:

1. **micro_ros_arduino**
   - Search for "micro_ros_arduino"
   - Install the latest version

2. **MPU6050** by Electronic Cats
   - Search for "MPU6050"
   - Install "MPU6050 by Electronic Cats"

3. **I2Cdevlib** (dependency for MPU6050)
   - If not automatically installed, search for "I2Cdev"

### Step 4: Configure the code

Open `microros_esp32_sensors_humble.ino` and update:

1. **WiFi credentials** (lines 16-17):
   ```cpp
   const char* ssid = "YOUR_WIFI_SSID";
   const char* password = "YOUR_WIFI_PASSWORD";
   ```

2. **ROS2 agent IP** (line 20):
   ```cpp
   IPAddress agent_ip(192, 168, 1, 100);  // Your PC's IP address
   ```

   To find your PC's IP:
   ```bash
   ip addr show | grep inet
   ```

3. **Pin definitions** (lines 24-26) - adjust if needed:
   ```cpp
   #define IR_SENSOR_PIN 25
   #define ENCODER_PIN_A 26
   #define ENCODER_PIN_B 27
   ```

### Step 5: Upload to ESP32

1. Connect ESP32 via USB
2. Select Tools → Board → ESP32 Arduino → ESP32 Dev Module (or your specific board)
3. Select Tools → Port → (your ESP32 port)
4. Click Upload

## Testing

### Step 1: Monitor Serial Output

Open Serial Monitor (115200 baud) to see:
- MPU6050 connection status
- WiFi connection status
- micro-ROS initialization

### Step 2: Verify ROS2 topics

In a new terminal:

```bash
source /opt/ros/humble/setup.bash
ros2 topic list
```

You should see:
- `/imu/data`
- `/ir_sensor/data`
- `/encoder/position`

### Step 3: View sensor data

```bash
# View IMU data
ros2 topic echo /imu/data

# View IR sensor data
ros2 topic echo /ir_sensor/data

# View encoder position
ros2 topic echo /encoder/position
```

## Troubleshooting

### ESP32 won't connect to WiFi
- Double-check SSID and password
- Ensure your WiFi is 2.4GHz (ESP32 doesn't support 5GHz)
- Check WiFi signal strength

### micro-ROS connection fails
- Verify PC IP address is correct
- Ensure micro-ROS agent is running
- Check firewall settings (allow UDP port 8888)
- Ensure ESP32 and PC are on the same network

### MPU6050 not detected
- Check I2C wiring (SDA and SCL)
- Try swapping SDA and SCL if still not working
- Verify 3.3V power supply

### Encoder not counting
- Check pull-up resistors (internal pull-ups are enabled in code)
- Verify wiring to GPIO 26 and 27
- Test encoder manually by rotating it

### No topics visible in ROS2
- Ensure micro-ROS agent is running
- Check ESP32 serial monitor for errors
- Verify network connectivity
- Try restarting the agent and ESP32

## Publishing Rate

The code publishes all sensor data at **100Hz** (every 10ms). To change this, modify line 176:

```cpp
const unsigned int timer_timeout = 10;  // Change to desired ms
```

## Additional Notes

- The IMU data is converted to standard ROS units (m/s² for acceleration, rad/s for angular velocity)
- The encoder tracks relative position (can be positive or negative)
- The IR sensor returns true/false (HIGH/LOW)
- All topics are published simultaneously at the same rate

## Next Steps

You can now:
- Create a ROS2 node to process this sensor data
- Log data with `ros2 bag record`
- Visualize IMU data in RViz2
- Build robot control systems using this sensor feedback
