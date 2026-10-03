---
title: Autonomous Insertion Challenge
summary: Team-based imitation learning for fiber-optic connector insertion with a simulated UR5e arm.
order: 2
objective: Learn robotic connector insertion.
outcome: '86/100 SFP score, résumé-reported · policy tuning in a team.'
tools: LeRobot · PyTorch · Diffusion Policy · Gazebo
role: Policy tuning and data collection in a team project
---
<section class="panel prose">

## Problem and objective

Train imitation-learning policies to insert SFP and SC fiber-optic plugs with a simulated UR5e arm in Gazebo for Intrinsic's AI for Industry Challenge.

</section>

<section class="panel prose">

## My contribution and approach

The supplied résumé describes tuning a Diffusion Policy with per-camera ResNet34 encoders, a wider U-Net and an extended action horizon.

It also records DAgger data collection to improve robustness to distribution shift and model training on the RWTH HPC cluster. This was a team project, not an individual challenge entry.

</section>

<section class="panel prose">

## Reported results and limitations

The résumé reports a **score of 86/100 on the SFP subtask**, a result above an ACT baseline, and a **35th-place team finish** in the global challenge.

These are author-reported results. No public leaderboard record, evaluation logs or code link was supplied for independent verification. The work concerns simulated insertion; it does not establish physical-robot performance.

</section>
