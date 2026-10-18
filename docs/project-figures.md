# Project figures

The homepage contains two static, accessible SVG figures:

- Seven-axis Kinova Gen3 with an ESP32 sensor controller.
- Six-axis UR5 with a held connector and a supported socket.

The figures describe simulation setups. They do not show calibrated hardware, physical validation or live policy inference.
The Gen3 controller maps MPU6050 inputs to X/Y, the encoder to Z, and the IR sensor to the gripper.
The UR5 connector remains between both gripper fingers, opposite the fixed socket.

## Build and test

`src/data/project-figures.json` contains the approved SVG geometry.
Normal builds and tests read this file without an Anatomy installation, network access or agent skills.
`tests/fixtures/preserved-hashes.json` protects its approved bytes.

With the built preview running, run:

```sh
SITE_URL=http://127.0.0.1:4336 npm run test:figures
```

The browser test covers joint counts, required parts, finite geometry, accessible descriptions, static behavior, contrast, viewport bounds and compressed size.
It captures both figures at 320px, 393px and 1440px in both themes, at 1× and 4× resolution.

## Optional regeneration

Regeneration is an authoring operation, not an installation or build step.
The generator uses the public [Anatomy source](https://github.com/wheresryan22/anatomy/tree/e9488296a44211c42701ff71705b7901470ec78f), revision `e9488296a44211c42701ff71705b7901470ec78f`.
The [MIT license](../scripts/ANATOMY-LICENSE.txt) identifies its copyright holder.
No toolkit implementation or private agent code is bundled with this repository.

From the portfolio root, obtain a separate toolkit checkout:

```sh
git clone https://github.com/wheresryan22/anatomy.git ../anatomy
git -C ../anatomy checkout --detach e9488296a44211c42701ff71705b7901470ec78f
ANATOMY_HOME=../anatomy npm run figures:build
```

The generator writes `src/data/project-figures.json`. It audits support, intersections and painter order before it writes the result.
It also asserts joint counts, finger contact, connector alignment and socket clearance.
These geometric assertions do not establish physical accuracy.

After a deliberate geometry change, examine the generated diff and browser captures before you update the approved hash fixture.
Do not update fixtures to conceal an unexplained test failure.

## References

- [Kinova Gen3 User Guide, R07](https://www.kinovarobotics.com/uploads/User-Guide-Gen3-R07.pdf), printed pages 13 and 61: seven-axis identity and actuator layout.
- [Universal Robots UR5 technical specification](https://www.universal-robots.com/media/1828033/ur5_tech_spec_web_en.pdf): six-axis UR5 identity.
- Local project and tutorial content describes the controller inputs, simulated robots and connector-insertion task.

The compact geometry is illustrative rather than a dimensional reconstruction of either manufacturer’s robot.
