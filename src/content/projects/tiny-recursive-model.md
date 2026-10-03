---
title: Tiny Recursive Model for Path Planning
summary: A compact recursive model that learns navigation policies on occupancy grids.
order: 1
objective: Learn occupancy-grid navigation.
outcome: '≈1.2M parameters · model development and evaluation.'
tools: PyTorch · Transformers
role: Model development and evaluation
image: /images/trm-tutorial.png
imageWidth: 1800
imageHeight: 945
thumbnail: /images/trm-demo-grid.jpg
thumbnailAlt: Recorded TRM occupancy grid with obstacles and path overlays
demo:
  src: /media/trm-training-and-path-demo.mp4
  poster: /images/trm-demo-poster.jpg
  width: 1920
  height: 1200
  sourceUrl: https://assets.super.so/7997a771-cb65-464f-bda6-2d05b8195df6/videos/7b3851b8-7d05-4663-86c5-4cf866e05e98/export-1780311693409.mp4
  description: 'Silent recording from the published tutorial: Rerun training metrics, then predicted and ground-truth paths on one grid. Not independently reproduced for this portfolio.'
imageAlt: Illustrated occupancy-grid path planning from the published TRM tutorial
caption: Illustration from the published tutorial; not an independently reproduced evaluation.
sources:
  - label: Project code
    url: https://github.com/AtharvaBhorpe/trm-pathplanning
  - label: Reported results
    url: https://github.com/AtharvaBhorpe/trm-pathplanning/blob/main/results.md
  - label: Project README
    url: https://github.com/AtharvaBhorpe/trm-pathplanning/blob/main/README.md
  - label: Published tutorial
    url: https://atharva-bhorpe.super.site/tutorials/teaching-a-tiny-recursive-model-to-plan-paths
---
<section class="panel prose">

## Problem and objective

Learn the next action at each free cell of an occupancy grid, given a start and a goal. BFS/Dijkstra supplies the ground-truth policy during data generation.

</section>

<section class="panel prose">

## My contribution and approach

- Implemented a recursive transformer for per-cell actions: north, south, east, west and stay.
- Used weight-shared recursion to increase effective depth without adding distinct layers.
- Evaluated path success, route optimality and latency against A* and parameter-matched CNN baselines.

The public README describes the model as approximately 1.2M parameters. The contribution summary is supported by the supplied résumé and repository documentation.

</section>

<section class="panel prose">

## Reported results and limitations

- The repository reports **100% path success** and optimal routes on 26×26 grids at 25% obstacle density.
- On 40×40 grids, it reports success rising from **52% to 75%** with more test-time recursion.
- Larger-grid success remains below 100% in these reported tests.

These are source-reported grid benchmarks. The evaluations have not been independently reproduced for this portfolio. They do not establish performance on a physical robot.

### Lessons

The reported larger-grid evaluations show a limit to generalization. More test-time recursion improves success in those tests, but does not eliminate failures.

</section>
