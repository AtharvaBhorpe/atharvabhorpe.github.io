---
title: Cost-effective AMR — RBot
summary: A student-built ROS platform intended for low-cost robotics education and research.
order: 4
objective: Build an affordable ROS mobile robot.
outcome: '5kg at 0.3m/s, author-reported · laptop-based ROS and firmware integration.'
tools: ROS · Arduino · ESP32 · Fusion 360
role: Integrating the ROS stack with Arduino firmware on ESP32
evidence: 'Source: author-supplied design portfolio, project text and figures. The source PDF is not a public download. No public code or raw test data was supplied.'
image: /images/amr-prototypes.png
imageWidth: 675
imageHeight: 520
thumbnail: /images/amr-thumbnail.png
thumbnailAlt: Final RBot prototype with its MDF enclosure
imageAlt: RBot initial prototype, rocker mechanism and final prototype from the supplied design portfolio
caption: Project photographs extracted from the supplied design portfolio.
---
<section class="panel prose">

## Problem and objective

Many mobile robots use expensive or proprietary hardware and software. RBot was designed as an affordable, modifiable platform for education, research and development.

This final-year college project involved five students: three from electronics and two from mechanical engineering. The supplied design portfolio describes LiDAR, tracking and depth cameras, and an IMU for SLAM and autonomous navigation.

</section>

<section class="panel prose">

## My contribution and approach

I integrated the ROS stack with the robot firmware, written with Arduino on an ESP32.

The team designed the robot in Fusion 360. Its chassis uses 20×20mm aluminium profiles, and its casing uses waterproof MDF board. The design allows changes to the electronics and actuator selection.

<figure>
<img src="/images/amr-architecture.png" width="743" height="764" alt="RBot hardware architecture: tracking camera and LiDAR feed a laptop; IMU and encoder feed ESP32; motor driver, relays and kill switches connect the control and power systems" loading="lazy" />
<figcaption>Hardware architecture from the supplied design portfolio. The author confirms that the final robot used a laptop.</figcaption>
</figure>

</section>

<section class="panel prose">

## Reported results and limitations

The team timed the robot over a dedicated **10-metre test track** with varied payloads. The recorded travel times were used to estimate speed.

<figure>
<img src="/images/amr-payload.png" width="780" height="446" alt="Source graph of robot speed versus payload, with payload from 5 to 15kg and speed decreasing as payload increases" loading="lazy" />
<figcaption>Original performance figure from the supplied PDF. No numerical values have been inferred from the graph.</figcaption>
</figure>

The PDF reports a prototype and a performance test, not a production deployment. These tests have not been independently reproduced for this portfolio.

The author confirms that the final **laptop-based robot carried 5kg at 0.3m/s**. This is an author-reported measurement, not an independent reproduction. The 10-metre track remains the documented test method; no additional timing or budget values are inferred.

</section>

<section class="panel prose">

## Source record

This case study uses the project text and figures in the two-page design portfolio supplied by the author. Only the project figures are included here; the source PDF is not published.

</section>
