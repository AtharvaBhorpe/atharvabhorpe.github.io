---
title: Teaching a Tiny Recursive Model to Solve Grid-Based Path Planning
summary: 'An honest evaluation of a small recursive model for occupancy-grid path planning: where it generalizes, where it fails, and how it compares with A* and CNNs.'
order: 1
cover: /images/writing/trm-article.png
coverAlt: Thumbnail for the Tiny Recursive Model path-planning article.
---

A few weeks ago, I got curious about the **Tiny Recursive Model** (TRM), a 2025 paper with a contrarian idea: instead of making a network bigger to solve harder problems, run a small network over its own output repeatedly. I wanted to really understand it, so I rebuilt it from scratch for a problem I care about as a robotics student: **2D path planning**. The model learns the optimal move at every cell of an occupancy grid, and I spent at least as much time trying to break it as I did building it.

This post is the honest tour: what worked, what generalized, what didn't, and where a classical planner from the 1960s still beats it.

## What is a Tiny Recursive Model

The whole idea is **reasoning by repetition with shared weights**. The model keeps three tensors of the same shape: the input grid (fixed), the answer it is building up, and a scratchpad it uses to think. One reasoning step does this:

1. Recurse the scratchpad a few times, holding the answer fixed. This is the "thinking".
2. Update the answer once from the freshly-updated scratchpad.
3. Decode the answer to predict an action for each cell.

The same tiny stack of layers does all of this, reused over and over. That weight sharing is the trick: a 2-layer model gets the **effective depth of a 30-layer one** (3 supervision steps times 5 recursions times 2 layers) while staying around 1.2 million parameters. Small enough to run on the kind of computer a robot actually carries.

## The task: planning on a grid

I generate random grids with obstacles, mark a start and a goal, and use a breadth-first search outward from the goal to label the single best move (north, south, east, west, or stay) at every free cell. That dense action field is the ground truth. The model sees the grid as a sequence of tokens (free, obstacle, start, goal) and has to predict the right move everywhere at once. Roll those moves out from the start, and you get a path.

To know whether the learned model is any good, I compare it against two honest baselines:

- **A\***, the classical optimal planner. It is correct by construction, so it is the oracle.
- **Two CNNs** matched to the same ~1.2M parameter budget, one shallow and one deep, to see whether you even need recursion.

## Does it actually work?

On the grids it trained on (26x26, 25% obstacles), yes, strikingly well:

| Method | Params | Success | Optimality |
| --- | ---: | ---: | ---: |
| A* (oracle) | — | 1.000 | 1.000 |
| **TRM** | 1.21M | **0.999** | **1.000** |
| CNN deep (27x27 field) | 1.21M | 0.898 | 1.019 |
| CNN shallow (9x9 field) | 1.20M | 0.128 | 1.004 |

The tiny recursive model matches the optimal A* planner to within 0.001 success rate, and the paths it does find are optimal.

The CNN gap tells the real story. All three learned models have the same parameter budget, but a stack of convolutions can only "see" a fixed window. The shallow CNN's 9x9 field physically cannot span a 26x26 grid, so it collapses to 0.128 success even though its per-cell predictions look fine in isolation. One wrong move breaks the whole path. Going deeper (a 27x27 field) recovers most of it, but the recursion still wins, because recursing gives the model an effectively global, iterative view of the grid that a fixed receptive field can't match.

## Watch it run

The recording shows the live training metrics in rerun, then a close-up on a single grid with the optimal-path layer toggled on, so you can see exactly where the predicted path lines up with the ground-truth shortest path.

<video controls playsinline preload="metadata" poster="/images/trm-demo-poster.jpg" width="1920" height="1200" aria-label="TRM path-planning training and prediction recording"><source src="/media/trm-training-and-path-demo.mp4" type="video/mp4" /></video>

## Generalizing to grids it never saw

Here is where it got genuinely interesting. The learned weights are per-cell and size-independent. The only part of the model that knows the grid size is its position encoding, and because that encoding is relative, I can rebuild it for a new grid size and run the exact same weights on a grid the model never trained on. No retraining.

| Grid size | Success |
| --- | ---: |
| 16x16 | 0.991 |
| 20x20 | 0.996 |
| 26x26 (trained) | 0.999 |
| 32x32 | 0.943 |
| 40x40 | 0.519 |

It holds up well to about 32x32, then falls off on much larger 40x40 grids. It also handles obstacle density it never saw essentially for free, staying above 0.99 success from 10% all the way to 40% obstacles. So density is easy, but size eventually bites.

## Letting it think longer

This is my favourite part. Because the recursion uses shared weights, I can run **more reasoning steps at inference than the model trained with**. Nothing about the weights changes, I just let it think for longer. On the hardest 40x40 grids, that recovered a big chunk of the lost accuracy:

| Reasoning steps at inference | Success on 40x40 |
| --- | ---: |
| 4 (as trained) | 0.519 |
| 6 | 0.656 |
| 8 | 0.749 |

That 52% climbed to 75% purely by adding recursion steps. The intuition is that a bigger grid means longer paths, and longer paths need more rounds of reasoning to propagate the route from the goal back to the start. The gains do plateau around 0.75, so it is not a free lunch, but a knob you can turn at deployment time to trade compute for accuracy is a genuinely useful property.

## What didn't work

I tried a position-interpolation trick I explored with an AI assistant, and was sure would help: rescale the position encodings so a 40x40 grid "looks like" the 26x26 range the model trained on. It consistently made things worse, monotonically so, the harder I rescaled. The reason in hindsight is that path planning needs fine local spatial resolution, and squashing the positions throws that away. It is the opposite of what helps language models with long context. A clean negative result, and it taught me more than another small win would have.

## Where it loses: speed

Time for the honest part. All that iterative reasoning is expensive. On small grids the TRM is the slowest of everything I compared:

| Method | Throughput (grids/sec, higher is better) |
| --- | ---: |
| A* (CPU, one path) | ~16,900 |
| CNNs (GPU) | ~8,500 to 14,000 |
| TRM (GPU) | ~433 |

Classical A* is optimal **and** faster on small grids, and scaling the grid up does not flip this, because the model's self-attention cost grows with grid area faster than A*'s search does. The recursion that makes the model smart is the same thing that makes it slow. So the value of a learned planner here is not raw speed on a clean grid. It is matching optimal accuracy at a tiny, fixed, predictable cost, and being able to dial that cost with the think-longer knob.

## Why I care, and what's next

The property I keep coming back to is **adaptive compute in a tiny model**: spend more reasoning when the problem is hard, less when it is easy, all in something small enough to deploy on a robot. I am curious whether that carries over from grid planning to real-time robotics planning and control, where you re-solve an optimization every control tick and a small "anytime" solver with a quality-versus-compute dial would be genuinely useful. That is the thread I want to pull next.

## Try it yourself

The full code, the architecture walkthrough, and every number above (including the experiments that failed) are in the repo:

- [GitHub: TRM path planning](https://github.com/AtharvaBhorpe/trm-pathplanning)

If you have worked with recursive or iterative models, or with learned planners, I would genuinely love to hear how you would approach it differently.

**Tags:** Machine Learning · Deep Learning · Robotics · Path Planning · PyTorch · Tiny Recursive Model
