export const profile = {
  name: 'Atharva Bhorpe',
  email: 'hello@atharvabhorpe.com',
  github: 'https://github.com/AtharvaBhorpe',
  linkedin: 'https://linkedin.com/in/atharvabhorpe',
  writing: '/writing/',
};
export const homeSections = [
  { id: 'home', label: 'Home', icon: 'm3 10 9-7 9 7M5 9v12h5v-7h4v7h5V9' },
  { id: 'projects', label: 'Projects', icon: 'M3 7V5h7l2 3h9v12H3V7Z M3 11h18' },
  { id: 'writing', label: 'Writing', icon: 'M5 3h10l4 4v14H5Z M14 3v5h5 M8 12h8 M8 16h6' },
  { id: 'contact', label: 'Contact' },
];

export const homeProjects = [
  { id: 'tiny-recursive-model', title: 'Tiny Recursive Model for Path Planning', objective: 'I built a recursive transformer for occupancy-grid path planning.', contribution: 'I evaluated path success, route optimality and latency against A* and parameter-matched CNNs.', scope: 'Approximately 1.2M parameters. Grid evaluations, not physical-robot tests.' },
  { id: 'cost-effective-amr', title: 'RBot: a cost-effective AMR', objective: 'Our five-student team built an affordable ROS mobile-robot prototype.', contribution: 'I integrated the ROS stack with Arduino firmware on an ESP32.', scope: 'Laptop-based student prototype for robotics education and research.' },
  { id: 'autonomous-insertion', title: 'Autonomous Insertion Challenge', objective: 'Our team trained imitation-learning policies for connector insertion with a simulated UR5e arm.', contribution: 'I focused on policy tuning and data collection.', scope: 'Gazebo simulation with SFP and SC fiber-optic plugs.' },
  { id: 'imu-controlled-arm', title: 'IMU-controlled Robotic Arm', objective: 'I built a sensor-based controller for a simulated Kinova Gen3 arm.', contribution: 'I connected IMU, rotary encoder and IR inputs to ROS 2 and MoveIt through an ESP32.', scope: 'Sensor-to-simulation control over WiFi and micro-ROS.' },
];
