#include <micro_ros_arduino.h>
#include <WiFi.h>
#include <Wire.h>
#include <MPU6050.h>

#include <rcl/rcl.h>
#include <rcl/error_handling.h>
#include <rclc/rclc.h>
#include <rclc/executor.h>

#include <sensor_msgs/msg/imu.h>
#include <std_msgs/msg/bool.h>
#include <std_msgs/msg/int32.h>

// WiFi credentials
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// ROS2 agent IP (your PC IP address)
IPAddress agent_ip(192, 168, 1, 100);  // Change to your PC's IP
char agent_ip_str[16];  // Buffer to hold IP as string

const int agent_port = 8888;

// Pin definitions
#define IR_SENSOR_PIN 25
#define ENCODER_PIN_A 26
#define ENCODER_PIN_B 27

// Define LED pin for your board
#define LED_BUILTIN 2  // Most ESP32 boards use GPIO2

// MPU6050 object
MPU6050 mpu;

// Encoder variables
volatile long encoder_position = 0;
volatile int last_encoded = 0;

// micro-ROS objects
rcl_publisher_t imu_publisher;
rcl_publisher_t ir_publisher;
rcl_publisher_t encoder_publisher;

sensor_msgs__msg__Imu imu_msg;
std_msgs__msg__Bool ir_msg;
std_msgs__msg__Int32 encoder_msg;

rclc_executor_t executor;
rclc_support_t support;
rcl_allocator_t allocator;
rcl_node_t node;
rcl_timer_t timer;

#define RCCHECK(fn) { rcl_ret_t temp_rc = fn; if((temp_rc != RCL_RET_OK)){error_loop();}}
#define RCSOFTCHECK(fn) { rcl_ret_t temp_rc = fn; if((temp_rc != RCL_RET_OK)){}}

void error_loop() {
  while(1) {
    digitalWrite(LED_BUILTIN, !digitalRead(LED_BUILTIN));
    delay(100);
  }
}

// Rotary encoder interrupt handler
void IRAM_ATTR encoder_ISR() {
  int MSB = digitalRead(ENCODER_PIN_A);
  int LSB = digitalRead(ENCODER_PIN_B);

  int encoded = (MSB << 1) | LSB;
  int sum = (last_encoded << 2) | encoded;

  if(sum == 0b1101 || sum == 0b0100 || sum == 0b0010 || sum == 0b1011) encoder_position++;
  if(sum == 0b1110 || sum == 0b0111 || sum == 0b0001 || sum == 0b1000) encoder_position--;

  last_encoded = encoded;
}

// Timer callback to publish sensor data
void timer_callback(rcl_timer_t * timer, int64_t last_call_time) {
  RCLC_UNUSED(last_call_time);
  if (timer != NULL) {
    // Read MPU6050 data
    int16_t ax, ay, az;
    int16_t gx, gy, gz;
    mpu.getMotion6(&ax, &ay, &az, &gx, &gy, &gz);

    // Fill IMU message
    imu_msg.header.stamp.sec = rmw_uros_epoch_millis() / 1000;
    imu_msg.header.stamp.nanosec = (rmw_uros_epoch_millis() % 1000) * 1000000;
    imu_msg.header.frame_id.data = "imu_link";
    imu_msg.header.frame_id.size = strlen("imu_link");
    imu_msg.header.frame_id.capacity = strlen("imu_link") + 1;

    // Convert to m/s^2 and rad/s
    imu_msg.linear_acceleration.x = ax / 16384.0 * 9.81;
    imu_msg.linear_acceleration.y = ay / 16384.0 * 9.81;
    imu_msg.linear_acceleration.z = az / 16384.0 * 9.81;

    imu_msg.angular_velocity.x = gx / 131.0 * 0.0174533;
    imu_msg.angular_velocity.y = gy / 131.0 * 0.0174533;
    imu_msg.angular_velocity.z = gz / 131.0 * 0.0174533;

    // Read IR sensor
    ir_msg.data = digitalRead(IR_SENSOR_PIN);

    // Read encoder position
    noInterrupts();
    encoder_msg.data = encoder_position;
    interrupts();

    // Publish messages
    RCSOFTCHECK(rcl_publish(&imu_publisher, &imu_msg, NULL));
    RCSOFTCHECK(rcl_publish(&ir_publisher, &ir_msg, NULL));
    RCSOFTCHECK(rcl_publish(&encoder_publisher, &encoder_msg, NULL));
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_BUILTIN, OUTPUT);

  // Initialize I2C for MPU6050
  Wire.begin();
  Wire.setClock(400000);

  // Initialize MPU6050
  mpu.initialize();
  if (!mpu.testConnection()) {
    Serial.println("MPU6050 connection failed!");
    while(1);
  }
  Serial.println("MPU6050 connected!");

  // Initialize IR sensor
  pinMode(IR_SENSOR_PIN, INPUT);

  // Initialize rotary encoder
  pinMode(ENCODER_PIN_A, INPUT_PULLUP);
  pinMode(ENCODER_PIN_B, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(ENCODER_PIN_A), encoder_ISR, CHANGE);
  attachInterrupt(digitalPinToInterrupt(ENCODER_PIN_B), encoder_ISR, CHANGE);

  // Connect to WiFi
  Serial.print("Connecting to WiFi");
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected!");
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());

  // Convert IPAddress to string
  sprintf(agent_ip_str, "%d.%d.%d.%d",
          agent_ip[0], agent_ip[1], agent_ip[2], agent_ip[3]);

  // Set micro-ROS transport
  // set_microros_wifi_transports((char*)ssid, (char*)password, agent_ip, agent_port);
  set_microros_wifi_transports((char*)ssid, (char*)password, agent_ip_str, agent_port);

  delay(2000);

  // Initialize micro-ROS
  allocator = rcl_get_default_allocator();

  // Create init_options
  RCCHECK(rclc_support_init(&support, 0, NULL, &allocator));

  // Create node
  RCCHECK(rclc_node_init_default(&node, "esp32_sensor_node", "", &support));

  // Create publishers
  RCCHECK(rclc_publisher_init_default(
    &imu_publisher,
    &node,
    ROSIDL_GET_MSG_TYPE_SUPPORT(sensor_msgs, msg, Imu),
    "imu/data"));

  RCCHECK(rclc_publisher_init_default(
    &ir_publisher,
    &node,
    ROSIDL_GET_MSG_TYPE_SUPPORT(std_msgs, msg, Bool),
    "ir_sensor/data"));

  RCCHECK(rclc_publisher_init_default(
    &encoder_publisher,
    &node,
    ROSIDL_GET_MSG_TYPE_SUPPORT(std_msgs, msg, Int32),
    "encoder/position"));

  // Create timer (100Hz = 10ms)
  const unsigned int timer_timeout = 10;
  RCCHECK(rclc_timer_init_default(
    &timer,
    &support,
    RCL_MS_TO_NS(timer_timeout),
    timer_callback));

  // Create executor
  RCCHECK(rclc_executor_init(&executor, &support.context, 1, &allocator));
  RCCHECK(rclc_executor_add_timer(&executor, &timer));

  // Initialize IMU message
  imu_msg.header.frame_id.data = (char*)malloc(20);
  imu_msg.header.frame_id.capacity = 20;

  Serial.println("micro-ROS setup complete!");
}

void loop() {
  RCSOFTCHECK(rclc_executor_spin_some(&executor, RCL_MS_TO_NS(100)));
  delay(10);
}
