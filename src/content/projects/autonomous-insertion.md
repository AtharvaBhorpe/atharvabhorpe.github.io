---
title: Autonomous Insertion Challenge
summary: I worked with a team to train imitation-learning policies for fiber-optic connector insertion with a simulated UR5 arm.
order: 2
objective: Learn robotic connector insertion.
outcome: '86/100 SFP score · policy tuning in a team.'
tools: LeRobot · PyTorch · Diffusion Policy · Gazebo
role: Policy tuning and data collection in a team project
evidence: These results describe our work in simulation. They do not establish performance on a physical robot.
---
<section class="panel prose">

## Problem and objective

Our goal was to insert SFP and SC fiber-optic plugs into a network board. We used a simulated UR5 arm with a Robotiq gripper in Gazebo.

The challenge allowed three trials of 180 seconds each, with 300 points available in total.

</section>

<section class="panel prose">

## My contribution and approach

I focused on policy tuning and data collection. We trained the models on the RWTH HPC cluster.

### Approaches we tried

We first used a CNN to predict the port pose from wrist-camera images. An impedance controller handled insertion, but this approach did not generalize.

We then tried ACT (Action Chunking Transformer) as our first end-to-end imitation policy.

We also set up an Isaac Lab environment for reinforcement learning with RSL-RL. A TF error in the supplied assets stopped that approach, and we did not return to it.

### Changes to the Diffusion Policy

We initially built the Diffusion Policy as a baseline for comparison with ACT. It performed better on harder rollouts, so we focused on it.

We tested each change separately before we combined them:

- We downscaled and cropped camera images to 288×288 pixels.
- We gave each camera a separate ResNet34 encoder.
- We increased the U-Net channel widths to `[256, 512, 1024]`.
- We increased the observation window to three steps.
- We extended the action horizon from 16 to 32 steps.

### Data collection with DAgger

We switched to DAgger for data collection. The policy controlled each rollout, and an expert corrected its actions.

This gave us data from states that the policy actually visited, rather than only expert demonstrations. It helped reduce the distribution-shift problems that we encountered with plain behavior cloning.

</section>

<section class="panel prose">

## Reported results and limitations

Our team finished **35th in the global challenge**, five places below the top-30 cutoff.

- Our final score was **176/300**.
- Our SFP score was **86/100**.
- Our SC score fell from **50/100 locally** to **1/100 on the evaluation portal**.

I suspect a mismatch in domain randomization caused the SC score gap. We ran out of time to resolve it.

These results describe our work in simulation. They do not establish performance on a physical robot.

</section>

<section class="panel prose">

## What I learned

I learned to collect data that reflects evaluation conditions from the start. The SC results showed the limits of our local evaluation.

I also underestimated the work needed to turn the task specification into a concrete implementation plan. Next time, I will spend more time on that plan before implementation.

</section>
