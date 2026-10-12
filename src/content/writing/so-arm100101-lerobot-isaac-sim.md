---
title: SO-ARM100/101 + LeRobot + Isaac Sim
summary: Team project to simulate an SO-ARM robot, integrate LeRobot and ROS 2, and explore imitation learning and reinforcement learning.
cover: /images/writing/so-arm-overview.png
coverAlt: SO-ARM100/101, LeRobot, and Isaac Sim project thumbnail.
---

## Goal

Successfully simulate a robot in Isaac Sim and integrate it with LeRobot and Isaac Lab for running ML models and RL training, documenting the complete process step-by-step.

## Scope

- Pick a cube and place it in a cup.
- Understand and implement SmolVLA on SO-ARM101 using LeRobot in simulation.
- Implement a ROS 2 driver for SO-ARM101.
- Connect the ROS 2 driver to simulation.
- Code forward kinematics and inverse kinematics for SO-ARM101.
- Make this project platform-agnostic.

## Prerequisites

### Software requirements

- Isaac Sim 5.1
- LeRobot framework
- Isaac Lab
- Python 3.11

### Hardware requirements

- RTX GPU with at least 16 GB VRAM
- At least 32 GB RAM
- 60–100 GB of storage

### Knowledge prerequisites

- Basic understanding of robotics simulation
- Familiarity with Python programming
- Basic knowledge of machine-learning and reinforcement-learning concepts

## Milestones

1. Environment setup — install and configure Isaac Sim, LeRobot, and Isaac Lab.
2. Robot import — import the SO-ARM100/101 model into Isaac Sim.
3. Simulation configuration — set up the simulation environment and parameters.
4. ROS 2 driver — create a digital twin between the physical arm and the simulated arm.
5. LeRobot integration — connect LeRobot with the simulated robot.
6. Isaac Lab setup — configure Isaac Lab for RL training.
7. ML model testing — run and test machine-learning models.
8. RL training — execute reinforcement-learning training loops.
9. Results analysis — evaluate and document training results.

## Tutorial steps

Work through these in order. Each guide provides the original walkthrough notes, screenshots, and code where available.

### Step 1 — Install and setup

Install ROS 2 Jazzy, Isaac Sim (using Pixi), and LeRobot.

[Open the install and setup guide →](/writing/so-arm-install-setup/)

### Step 2 — Import SO-ARM100/101 into Isaac Sim

Download the URDF, import and configure it (static base, articulation root, physics scene, ground plane), then build the ROS 2 Action Graph for joint-state publish and subscribe.

[Open the Isaac Sim import guide →](/writing/so-arm-import-isaac-sim/)

### Step 3 — Set up MoveIt 2

Create the ROS 2 workspace, install MoveIt and controllers, generate the configuration with the Setup Assistant, fix the known `joint_limits.yaml` and `moveit_controllers.yaml` issues, and test motion planning before connecting Isaac Sim.

[Open the MoveIt 2 setup guide →](/writing/so-arm-moveit-setup/)

## References

- [SO-ARM ROS 2 URDF repository](https://github.com/MuammerBay/SO-ARM_ROS2_URDF)
- [Isaac Sim documentation](https://docs.isaacsim.omniverse.nvidia.com/)
- [LeRobot](https://github.com/huggingface/lerobot)
- [YaoHui: Import and control LeRobot SO100 arm in Isaac Sim](https://youtu.be/buiqdmNQKwY)
- [robot mania: Use LeRobot, Isaac Sim, and ROS 2](https://youtu.be/eO5wMzw9LeQ)
