---
title: Import SO-ARM100/101 into Isaac Sim
summary: Import the arm URDF into Isaac Sim, add physics and ground, and connect ROS 2 with an Action Graph.
parent: so-arm100101-lerobot-isaac-sim
---

The original walkthrough follows [YaoHui's tutorial](https://youtu.be/buiqdmNQKwY) and records the project-specific setup notes below.

## 1. Download the SO-ARM100 URDF

Use the [SO-ARM100/101 URDF repository](https://github.com/TheRobotStudio/SO-ARM100). The project notes also use [MuammerBay's ROS 2 URDF repository](https://github.com/MuammerBay/SO-ARM_ROS2_URDF) for ROS 2 integration.

## 2. Start Isaac Sim

For the Pixi environment, start Isaac Sim from the project directory:

```sh
pixi run isaac-sim
```

The source notes also show the arm repository being cloned from the Pixi project directory:

```sh
cd isaaclab-pixi
git clone https://github.com/TheRobotStudio/SO-ARM100.git
```

## 3. Import the URDF into Isaac Sim

In Isaac Sim, use **File → Import** and select the downloaded URDF. Review the import options before confirming. The screenshots below are from the original walkthrough.

![Open the Import menu in Isaac Sim](/images/writing/so-arm-step-01.jpg)

![Select the SO-ARM URDF and review import options](/images/writing/so-arm-step-02.jpg)

## 4. Change the Articulation Root

After import, inspect the robot hierarchy and set the articulation root on the intended robot root prim. Confirm that the arm appears in the stage and that its joints are included in the articulation.

![Imported arm in the Isaac Sim stage](/images/writing/so-arm-step-03.jpg)

![Select the arm's root prim and inspect its articulation properties](/images/writing/so-arm-step-04.jpg)

![Review the articulation settings](/images/writing/so-arm-step-05.jpg)

## 5. Add Physics Scene and Ground Plane

Add a physics scene and a ground plane to the stage, then check that the robot sits on the ground and can be simulated.

![Add a physics scene to the stage](/images/writing/so-arm-step-06.jpg)

![Add the ground plane](/images/writing/so-arm-step-07.jpg)

![Arm on the ground plane](/images/writing/so-arm-step-08.jpg)

![Inspect the arm and scene after adding the ground plane](/images/writing/so-arm-step-09.jpg)

## 6. Add an Action Graph for ROS 2

Create an Action Graph to publish joint states from the simulation and receive joint commands through ROS 2. The original screenshots show the graph nodes and their connections.

![Action Graph overview for the simulated arm](/images/writing/so-arm-step-10.jpg)

![ROS 2 publish and subscribe nodes in the Action Graph](/images/writing/so-arm-step-11.jpg)

![Connect the ROS 2 nodes to the articulation controller](/images/writing/so-arm-step-12.jpg)

![Review the completed Action Graph and node settings](/images/writing/so-arm-step-13.jpg)

## References

- [YaoHui: How to import and control the LeRobot SO100 arm in Isaac Sim](https://youtu.be/buiqdmNQKwY)
- [SO-ARM100 repository](https://github.com/TheRobotStudio/SO-ARM100)
- [Isaac Sim documentation](https://docs.isaacsim.omniverse.nvidia.com/)
- [Project overview and other setup guides](/writing/so-arm100101-lerobot-isaac-sim/)
