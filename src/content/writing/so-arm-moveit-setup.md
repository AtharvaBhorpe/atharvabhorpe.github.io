---
title: Set up MoveIt 2 on SO-ARM100/101 in Isaac Sim
summary: Create a ROS 2 Humble workspace, generate a MoveIt configuration, and test it before connecting the simulated arm.
parent: so-arm100101-lerobot-isaac-sim
---

The steps below were transcribed from the [original tutorial video](https://youtu.be/Ym5jav5scfA).

## 1. Download the URDF

Use the [SO-ARM ROS 2 URDF repository](https://github.com/MuammerBay/SO-ARM_ROS2_URDF).

## 2. Create a ROS workspace

```sh
mkdir -p ~/so-arm_moveit_isaacsim_ws/src
cd ~/so-arm_moveit_isaacsim_ws
```

Install the ROS 2 Jazzy MoveIt and control dependencies used in the walkthrough:

```sh
sudo apt update
sudo apt install \
  ros-jazzy-moveit \
  ros-jazzy-ros2-control \
  ros-jazzy-ros2-controllers \
  ros-jazzy-gripper-controllers \
  ros-jazzy-topic-based-ros2-control
```

Create the configuration and robot-description folders:

```sh
cd ~/so-arm_moveit_isaacsim_ws/src
mkdir -p so_arm_moveit_config
mkdir -p so_arm_description
```

Copy the URDF files into `so_arm_description`. The trailing `.` clones the repository contents into the current directory rather than creating another nested folder:

```sh
cd ~/so-arm_moveit_isaacsim_ws/src/so_arm_description
git clone https://github.com/MuammerBay/SO-ARM_ROS2_URDF.git .
```

Build the workspace:

```sh
cd ~/so-arm_moveit_isaacsim_ws
colcon build
```

## 3. Generate the MoveIt configuration

Source the workspace so the Setup Assistant can find the robot-description package. (The original notes say this step is not needed for a Pixi ROS 2 setup.)

```sh
source ~/so-arm_moveit_isaacsim_ws/install/setup.bash
ros2 launch moveit_setup_assistant setup_assistant.launch.py
```

Use the MoveIt Setup Assistant to create the configuration. Then rebuild:

```sh
cd ~/so-arm_moveit_isaacsim_ws
colcon build
```

## 4. Test MoveIt before Isaac Sim

Source the installed workspace and launch the demo:

```sh
source install/setup.bash
ros2 launch so_arm_moveit_config demo.launch.py
```

## 5. Apply the configuration fixes from the walkthrough

- In `joint_limits.yaml`, replace integer values with floating-point values where shown in the video.
- In `moveit_controllers.yaml`, add these keys to `arm_controller`:

```yaml
action_ns: follow_joint_trajectory
default: true
```

Rebuild the workspace and test MoveIt again before connecting Isaac Sim:

```sh
colcon build
ros2 launch so_arm_moveit_config demo.launch.py
```

## Related guides

- [Import the arm into Isaac Sim](/writing/so-arm-import-isaac-sim/)
- [Project overview](/writing/so-arm100101-lerobot-isaac-sim/)
