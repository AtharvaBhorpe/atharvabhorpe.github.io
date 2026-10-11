#!/bin/bash

# Setup micro-ROS for ROS2 Humble
# This script sets up the micro-ROS agent on your PC

set -e

echo "=== Setting up micro-ROS workspace for ROS2 Humble ==="

# Check if ROS2 is sourced
if [ -z "$ROS_DISTRO" ]; then
    echo "ROS2 not sourced! Sourcing /opt/ros/humble/setup.bash"
    source /opt/ros/humble/setup.bash
fi

# Create workspace
WORKSPACE_DIR=~/microros_ws
mkdir -p $WORKSPACE_DIR/src
cd $WORKSPACE_DIR

# Clone micro-ROS packages
echo "Cloning micro-ROS agent..."
git clone -b humble https://github.com/micro-ROS/micro_ros_setup.git src/micro_ros_setup

# Install dependencies
echo "Installing dependencies..."
sudo apt update
rosdep update
rosdep install --from-paths src --ignore-src -y

# Build workspace
echo "Building micro-ROS workspace..."
colcon build
source install/local_setup.bash

# Create and build micro-ROS agent
echo "Creating micro-ROS agent..."
ros2 run micro_ros_setup create_agent_ws.sh
ros2 run micro_ros_setup build_agent.sh

echo ""
echo "=== Setup complete! ==="
echo ""
echo "To run the micro-ROS agent, use:"
echo "  cd $WORKSPACE_DIR"
echo "  source install/local_setup.bash"
echo "  ros2 run micro_ros_agent micro_ros_agent udp4 --port 8888"
echo ""
