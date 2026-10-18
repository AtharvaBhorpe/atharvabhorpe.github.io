---
title: Autonomous Insertion Challenge
summary: I worked with a team to train imitation-learning policies for fiber-optic connector insertion with a simulated UR5e arm.
order: 2
objective: Learn robotic connector insertion.
outcome: '86/100 SFP score · policy tuning in a team.'
tools: LeRobot · PyTorch · Diffusion Policy · Gazebo
role: Policy tuning and data collection in a team project
evidence: These results describe our work in simulation. They do not establish performance on a physical robot.
---
<section class="panel prose">

## Problem and objective

Our goal was to insert SFP and SC fiber-optic plugs into a network board. We used a simulated UR5e arm with a Robotiq gripper in Gazebo.

The challenge allowed three trials of 180 seconds each, with 300 points available in total.

</section>

<section class="panel prose">

## My contribution and approach

I focused on policy tuning and data collection. We trained the models on the RWTH HPC cluster.

### Approaches we tried

We first used a CNN to predict the port pose from wrist-camera images. An impedance controller handled insertion, but this approach did not generalize.

We then tried ACT (Action Chunking Transformer) as our first end-to-end imitation policy.

We also set up an Isaac Lab environment for reinforcement learning with RSL-RL. A TF error in the supplied assets stopped that approach, and we did not return to it.

We initially built the Diffusion Policy as a baseline for comparison with ACT. It performed better on harder rollouts, so we focused on it.

The architecture below describes our DAgger implementation. My contribution remained policy tuning and data collection within the team. It does not imply that I built every component.

</section>

<section class="panel prose">

## What the model actually is

**This is a vision-conditioned Diffusion Policy, not a language-conditioned VLA.** VLA usually means vision, language, and action. This implementation has no language encoder, tokenizer, language tokens, or language-to-action attention.

The task enters as nine categorical values, not a natural-language instruction. The dataset also stores a task sentence as metadata. The Diffusion Policy does not consume that sentence.

This explanation follows the DAgger collection, training, and inference paths, with their pinned LeRobot 0.5.1 implementation. Other policy configurations in the repository do not establish which model ran.

**Configuration is not a run record.** The primary training launcher specifies 400,000 updates. A second launcher specifies 600,000. Both accept overrides, and resumed training reads the saved configuration.

The available implementation does not establish the final submitted checkpoint, completed update count, dataset size, or exact sequence of DAgger iterations. The dimensions below describe the current fresh-training configuration, not independently verified properties of every competition run.

</section>

<section class="panel prose">

## End-to-end architecture

<div data-policy-architecture-placeholder></div>

### Observations and state

Three wrist-mounted cameras supply left, center, and right RGB images. The raw resolution is 1152 × 1024 pixels. The collection code halves each image to 576 × 512 pixels.

Training preparation takes a 288 × 288 center crop. The crop starts at pixel (144, 112) in the resized image. Inference applies the same resize and crop. The model does not stretch the full image into a square.

The tensor order is channels, height, width. Each image has shape `3 × 288 × 288`, with pixel values divided by 255 before normalization.

Each observation also contains an 18-value state:

- Three values describe the tool control point (TCP) position.
- Six values describe rotation as the first two columns of its rotation matrix.
- Two one-hot values identify SFP or SC.
- Five one-hot values identify the target rail.
- Two one-hot values identify the target port.

The state does not contain joint angles, joint velocities, or force/torque readings. The controller can use force feedback without those readings becoming learned-policy inputs.

The default training path uses ImageNet channel means and standard deviations for images. It uses dataset minimum and maximum values for state and action normalization to the interval [−1, 1]. Inference restores the saved processors and their statistics from the checkpoint.

### Visual features and fusion

Each camera has its own ResNet34, initialized with ImageNet weights. The encoders do not share parameters. Their average-pooling and classification layers are removed.

A 288 × 288 image produces a `512 × 9 × 9` backbone feature map. A learned 1 × 1 convolution maps its channels to 64 spatial maps. Spatial softmax converts each map into an expected X/Y coordinate.

These 64 coordinate pairs become 128 values. A 128-to-128 linear layer and ReLU produce the camera feature vector.

All three visual encoders remain trainable. The configuration retains BatchNorm in the backbones. GroupNorm belongs to the temporal U-Net, not these pretrained backbones.

The model concatenates three camera vectors and the state: `128 + 128 + 128 + 18 = 402`. It flattens three consecutive observations into a 1,206-value conditioning vector.

The temporal context uses a queue, not a recurrent network. At the start of a trial, the queue repeats the first observation until enough history exists.

### Temporal diffusion head

The prediction is a `32 × 9` action sequence. Each action describes an absolute TCP pose: three position values and six rotation values. It is not a joint command, pose increment, or learned gripper command.

A one-dimensional U-Net operates along the 32-step time axis. Its channel widths are 256, 512, and 1,024. Each down stage contains two conditional residual blocks. Two stride-two convolutions reduce the temporal length from 32 to 16 to 8.

Two residual blocks process the bottleneck. The up path combines saved features through skip connections and restores the original temporal length. A final convolution returns nine values per timestep.

Each residual block uses kernel-size-five convolutions, eight-group GroupNorm, and Mish activations. FiLM applies a learned scale and bias from the conditioning vector.

The diffusion timestep has a 128-value sinusoidal embedding and a 128 → 512 → 128 MLP. The U-Net combines it with observation context. Each residual block receives 1,334 conditioning values.

There is no text branch, cross-attention layer, or pretrained language model in this architecture.

### Denoising and execution

Training uses DDPM with 100 noise timesteps and the squared-cosine schedule. The network predicts the added Gaussian noise, rather than predicting clean actions directly.

Inference replaces DDPM with DDIM and defaults to ten denoising steps. It retains the trained noise schedule and clips estimated normalized samples to [−1, 1]. DDIM does not make whole rollouts deterministic: each new action sequence starts from sampled Gaussian noise.

With three observations, the model selects prediction indices 2 through 9, inclusive. It queues those eight actions and executes one per control cycle. After the queue empties, it predicts another sequence from the latest observation history.

The loop targets 20 Hz. Eight actions therefore represent a nominal 0.4-second chunk, not a measured latency or guaranteed execution rate. Slow inference or simulation can extend the cycle.

The postprocessor restores action units. Gram–Schmidt orthogonalization converts the six rotation values into a rotation matrix and then a quaternion.

The policy sends the target pose in the robot base frame. The Cartesian controller handles the joints, with stiffness, damping, and wrench feedback. Gazebo executes the simulated UR5e motion. The learned output does not directly specify motor torques.

The policy resets its queues for each trial. The dedicated inference path has no teacher correction. The homepage animation illustrates the task geometry only. It does not run this model.

</section>

<section class="panel prose">

## Collection and DAgger

DAgger means Dataset Aggregation. Its purpose here is to collect expert labels at states that the learner visits, not only along successful expert trajectories.

<figure class="technical-flow" aria-labelledby="dagger-caption">
  <ol class="flow-chain">
    <li><strong>Collect initial demonstrations</strong><span>The programmed expert controls the simulated arm and supplies the target-pose labels. No learner checkpoint is required.</span></li>
    <li><strong>Train the first learner</strong><span>Prepare images and statistics. Fit the Diffusion Policy to the expert labels.</span></li>
    <li><strong>Roll out the mixture</strong><span>At eight-step boundaries, beta selects expert or learner control. The expert still supplies every recorded action label.</span></li>
    <li><strong>Append complete episodes</strong><span>Keep observations from the visited states, expert target poses, task metadata, and expert phase. Failed trials can contribute data too.</span></li>
    <li><strong>Train again and evaluate</strong><span>Train on the accumulated dataset, or explicitly resume a checkpoint. Test the learner separately before the next collection round.</span></li>
  </ol>
  <p class="flow-return">Repeat from mixture rollouts with the next checkpoint and beta value.</p>
  <figcaption id="dagger-caption">Workflow diagram. Arrows show phase order. Beta is the probability of expert control, not the fraction of expert labels: every recorded label comes from the expert.</figcaption>
</figure>

### Expert and learner roles

The expert is a programmed simulator oracle. It uses privileged transforms for the target port, connector tip, and gripper TCP. It does not infer those poses from camera images.

Its state machine aligns the connector in X/Y, descends to a safe approach height, and inserts. X/Y error gates descent. Integral corrections help during expert control. During learner control, the expert avoids accumulating corrections for actions that it did not execute.

There is no human takeover in this DAgger path. The learner controls selected action chunks. The oracle supplies corrective target poses from the states reached during those chunks.

The example loop sets beta to `1.0 → 0.9 → 0.8 → 0.7 → 0.5 → 0.3`. Its default is 30 trials per iteration. These are script defaults, not evidence that the team completed all six rounds.

A random choice selects the controlling policy every eight steps. A controller change clears stale learner actions. The executed action and the recorded label can therefore differ.

There are important exceptions to beta selection:

- Without a usable learner checkpoint, the expert controls the rollout.
- If learner inference fails, collection falls back to the expert.
- With beta above zero, prolonged insertion forces expert control after 100 SFP frames or 200 SC frames.
- The separate stuck-descent rescue switch is disabled in the inspected implementation.

Beta zero disables the phase-based override, but does not remove the missing-learner or failed-inference fallback. A beta-zero collection run alone does not prove pure learner evaluation.

### Episodes and dataset

Each trial initializes the task categories, expert state, and learner queues. Trial configurations vary the connector and target arrangement in simulation. Collection enables the privileged transforms that the oracle needs.

The recorder appends to a LeRobot dataset. It stores image streams as H.264 video and frame values as Parquet data. Metadata preserves episode boundaries, task descriptions, timestamps, and statistics.

Each recorded frame pairs the current observation with the oracle's absolute target pose. It also records the expert phase: alignment, descent, or insertion. The recorder keeps all three phases.

All three camera images must contain data before a frame enters the dataset. An insertion event, wall-time timeout, or shutdown ends the episode. The collection policy has a 90-second wall-time limit.

The recorder can save any nonempty episode. This includes failed or timed-out trials. This path does not filter exclusively for success. It saves and finalizes the episode before any success hold, so the next process can append data.

Image preparation crops videos and updates their shape metadata. It preserves the frame data and episode structure. The crop script does not recompute image statistics. Default training substitutes ImageNet image statistics, while state and action statistics come from the dataset.

The fresh-training launcher selects every episode. It does not create a held-out validation split. Other evaluation utilities in the repository do not establish that a split existed for this training path.

</section>

<section class="panel prose">

## Training and evaluation

The loss is mean squared error between sampled Gaussian noise and the U-Net's predicted noise. Training samples a noise timestep, corrupts the action sequence, and conditions the prediction on the observation history.

Sequences respect episode boundaries through repeated boundary values. The inherited sampler drops the last seven frames of each episode. Padding-loss masking remains disabled in the inspected defaults. These defaults matter after increasing the prediction horizon to 32.

The main fresh-training configuration uses:

- Adam with learning rate `1e-4`, betas `(0.95, 0.999)`, epsilon `1e-8`, and weight decay `1e-6`.
- A cosine learning-rate schedule with 500 warmup updates.
- Batch size 64, seed 42, and mixed precision enabled.
- Up to three image transforms selected from brightness, contrast, saturation, hue, and sharpness changes.
- Checkpoints every 5,000 updates and at the final update.
- Automatic environment evaluation disabled in the training loop.

The optimizer receives both the visual encoders and diffusion head. The inspected LeRobot trainer does not maintain an exponential moving average (EMA) of this policy. A diffusion model does not imply an EMA checkpoint.

A checkpoint includes model weights, configuration, normalization processors, and training state. Resume mode restores the optimizer, scheduler, and update counter. An optional wrapper can extend the learning-rate schedule for a longer run.

Dataset aggregation appends new episodes to the collection dataset. Training and checkpoint transfer remain manual steps in the example loop. A fresh run and a resumed run are different choices. The loop does not automatically fine-tune the previous learner or select the best checkpoint.

The dedicated evaluation policy loads the checkpoint and runs without the privileged oracle. Local trials and portal evaluation are distinct. The source alone does not establish which checkpoint, stopping rule, or validation result determined the final submission.

I do not report a parameter count, measured inference latency, or per-iteration success curve here. Those values need a matching run record, not an architecture estimate.

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
