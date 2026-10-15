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
  { id: 'tiny-recursive-model', title: 'Tiny Recursive Model for Path Planning', objective: 'Learn navigation on occupancy grids.', contribution: 'Model development and evaluation.', scope: 'Approximately 1.2M parameters; reported grid evaluations, not physical-robot validation.' },
  { id: 'cost-effective-amr', title: 'RBot: a cost-effective AMR', objective: 'Build an affordable ROS mobile robot.', contribution: 'Connect the ROS stack to Arduino firmware on ESP32 in a student team.', scope: 'A documented prototype, not a production deployment.' },
  { id: 'autonomous-insertion', title: 'Autonomous Insertion Challenge', objective: 'Learn connector insertion with a simulated UR5e arm.', contribution: 'Policy tuning and data collection in a team.', scope: 'Simulation results.' },
  { id: 'imu-controlled-arm', title: 'IMU-controlled Robotic Arm', objective: 'Control a simulated Kinova arm with sensor inputs.', contribution: 'Integrate IMU, encoder and IR inputs with robot control.', scope: 'A working simulation pipeline without published accuracy or latency measurements.' },
];
