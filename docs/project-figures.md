# Project figures

The homepage uses the existing Anatomy SVG style for two robot illustrations.
These diagrams show simulation concepts, not manufacturer CAD, hardware results or live policy inference.

## Robot identity and geometry

The sensor project retains the seven-axis **Kinova Gen3**.
Its MPU6050 commands X/Y motion, its encoder commands Z, and its IR sensor opens or closes the gripper.

The insertion project uses the six-axis **UR5e**.
The schematic uses UR5e arm lengths and wrist offsets from the manufacturer's public description.
Its dimensions are scaled for the illustration, not calibrated for robot control.

An upright NIC card stands on a supported task board and horizontal workbench.
Two SFP openings face upward from horizontal top brackets.
The held module aligns above one opening, inserts downward, withdraws vertically and returns above the fixture.
The NIC card, socket and workbench do not move.
The module stays between the gripper fingers throughout the cycle.

We corrected and captured the static scene before we added motion.
The separate Kinova project's identity and article were not changed.

## Runtime and accessibility

`src/lib/project-motion.mjs` defines two bounded, 18-second illustrative cycles.
A fixed-branch two-link solution preserves link lengths. It is not a general inverse-kinematics solver.
`src/lib/project-scene.mjs` generates both the static fallback and moving SVG paths.
The client updates existing paths. It does not replace the entire figure or move a rigid arm image.

Each figure has a keyboard- and touch-accessible Play/Pause button.
Reduced motion starts with a still figure. Play explicitly starts motion under that preference.
Offscreen figures and hidden documents stop their animation frames.
Page suspension and component removal cancel callbacks and observers.
Phase captions are visual labels, not live announcements or measured sensor readings.
The SVG title and description remain available to screen readers.
Without JavaScript, the complete still figure and caption remain visible. The inactive button stays hidden.

## Build and checks

```sh
npm ci --ignore-scripts
npm run figures:build
npm run test:motion:model
npm run check
npm run build
npm test
npm run audit
```

The generator checks 37 poses per figure and finds one painter order for the entire bounded cycle.
Checks cover solid budgets, supports, clearance, housing/link seats, depth order, surface coverage and connector attachment.
Model tests sample 3,602 poses for rigid lengths, mapped commands, insertion alignment and loop continuity.
Browser tests cover controls, lifecycle, reduced motion, no-JS fallbacks, clipping and console errors.
The committed SVG remains the initial image. Tests do not depend on an external toolkit installation.

For focused browser checks against a separate built preview:

```sh
SITE_URL=http://127.0.0.1:4337 npm run test:figures
SITE_URL=http://127.0.0.1:4337 npm run test:motion
```

Use `EVIDENCE_DIR` to choose the screenshot directory. Do not publish raw captures automatically.
Browser emulation does not replace physical iPad, iPhone or Safari review.

## Public references and license

- [Universal Robots ROS2 description](https://github.com/UniversalRobots/Universal_Robots_ROS2_Description): UR5e kinematic dimensions.
- [Anatomy toolkit revision](https://github.com/wheresryan22/anatomy/tree/e9488296a44211c42701ff71705b7901470ec78f), copyright (c) 2026 Ryan.
- Bundled toolkit modules: `scripts/anatomy/`.
- MIT license: `scripts/ANATOMY-LICENSE.txt`.

The drawing modules match that public revision. The bundled audit module retains one tube-sampling adaptation. These figures contain no tubes.
The original figure geometry and motion retain the toolkit attribution.
Research material is not included in the website, documentation assets or browser bundles.

## Policy architecture figure

The Autonomous Insertion article uses a conventional computational architecture diagram with three flat SVG panels.
The robot figures, animations, DAgger diagram and surrounding explanation remain unchanged.

- Panel A shows three independent ResNet34 encoders, visual projection, state concatenation and three-observation history.
- Panel B shows the conditional temporal U-Net, timestep embedding, FiLM conditioning and two skip connections.
- Panel C shows the DDIM inference loop and eight-action selection from the 32-action prediction.

The two downsampling and two upsampling operations use tapered shapes.
The last down stage has no additional downsampling. The diagram does not invent a third skip connection.
Skip features concatenate before the two up stages. The final noise head has no FiLM input.
Solid, dashed and dotted arrows distinguish signal, conditioning and skip paths.
Training loss appears separately from the inference flow.

The caption distinguishes configuration dimensions from a verified competition checkpoint.
A complete HTML equivalent remains visible outside the SVG.
On narrow screens, each panel scrolls horizontally inside the figure. The page does not overflow.
The diagram has no client script, animation or custom controls. It works without JavaScript.

```sh
npm run architecture:build
npm run build
SITE_URL=http://127.0.0.1:4337 npm run test:architecture
```

The generator writes `src/data/policy-architecture.json` without the robot geometry toolkit.
The Project layout replaces one explicit article marker with trusted, build-time HTML.
The `--check` option compares the generated artifact with the stored artifact.
Tests cover tensor metadata, skip destinations, label bounds, local scrolling, accessible descriptions and no-JS behavior.
The browser matrix covers both themes at five widths. The full `npm test` command includes these tests.
Physical Safari, iPhone and iPad review remains separate.
