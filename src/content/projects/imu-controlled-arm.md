---
title: IMU-controlled Robotic Arm
summary: An ESP32-based teleoperation system for Cartesian control of a simulated Kinova arm.
order: 3
objective: Control a simulated arm with sensors.
outcome: 'IMU + encoder + IR · control integration.'
tools: ROS 2 Humble · MoveIt · ESP32 · Arduino
role: Sensor-input and robot-control integration
sources:
  - label: Project tutorial
    url: https://atharva-bhorpe.super.site/tutorials/rss-project-hub
  - label: Project repository
    url: https://github.com/AtharvaBhorpe/kinova_gen3_moveit_servo
---
<section class="panel prose">

## Problem and objective

Control a simulated Kinova arm in Cartesian space with a handheld sensor system rather than a conventional robot interface.

The published tutorial describes an ESP32 streaming sensor inputs over WiFi via UDP and micro-ROS to ROS 2. MoveIt turns those inputs into robot motion commands.

</section>

<section class="panel prose">

## My contribution and approach

The supplied résumé records building the teleoperation system and integrating three input devices:

- **MPU6050 IMU:** X–Y end-effector motion.
- **Rotary encoder:** Z-axis motion.
- **IR sensor:** gripper open and close.

The tutorial lists ROS 2 Humble, MoveIt, ESP32 and Arduino, with the MPU6050 connected over I2C.

</section>

<section class="panel prose">

## Reported results and limitations

The published tutorial and résumé describe the working control pipeline for a simulated arm. They do not supply quantitative accuracy, latency or task-success measurements.

This portfolio does not claim deployment on a physical Kinova arm. The linked repository is available, but its README currently contains only the project name. The public tutorial provides the fuller system description.

</section>
