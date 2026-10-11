---
title: Robotic Arm Control using IMU (RSS Project)
summary: An ESP32-based teleoperation system that drives a simulated Kinova arm in Cartesian space using IMU, encoder, and IR sensor inputs.
order: 7
---

An ESP32-based teleoperation system that drives a simulated Kinova arm in Cartesian space. Sensor inputs on the ESP32 are streamed over WiFi as raw UDP via micro-ROS into ROS 2, where MoveIt turns them into real-time motion commands.

## How it works

- **IMU (MPU6050)** → X–Y motion of the end-effector
- **Rotary encoder** → Z-axis motion
- **IR sensor** → gripper open / close
- Pipeline: **ESP32 → micro-ROS (UDP) → ROS 2 Humble → MoveIt → Kinova arm**

## Hardware

- ESP32 development board
- MPU6050 IMU (I2C)
- Rotary encoder
- Digital IR sensor

## Guides

Start with the micro-ROS setup, then use the sensor-interfacing notes:

- [micro-ROS setup for ROS 2 Humble →](/writing/microros-setup-humble/)
- [Interfacing an IR sensor with ROS 2 →](/writing/interfacing-ir-sensor-ros2/)
