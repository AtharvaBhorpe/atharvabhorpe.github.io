import { profile } from './site.ts';
// Tutorial paths: public index/article pages. Video: author's channel RSS and YouTube oEmbed.
export const writing = [
  { title: 'Teaching a Tiny Recursive Model to Solve Grid-Based Path Planning', path: 'teaching-a-tiny-recursive-model-to-plan-paths' },
  { title: 'Install Isaac Lab in 5 Minutes with Pixi: A Modern Approach to Robotics Development', path: 'install-isaac-lab-in-5-minutes-with-pixi-a-modern-approach-to-robotics-development' },
  { title: 'SO-ARM100/101 + LeRobot + Isaac Sim', path: 'so-arm100101-lerobot-isaac-sim' },
  { kind: 'Video', title: 'SO-ARM101 in Isaac Sim + ROS 2 + MoveIt 2', url: 'https://www.youtube.com/watch?v=0vvhCdKZyQE' },
].map(entry => ({ kind: entry.kind || 'Tutorial', title: entry.title, url: entry.url || `${profile.writing}/${entry.path}` }));
