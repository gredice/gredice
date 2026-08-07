# Developmental plant generation

Every procedural plant in the game is generated from a shared developmental
organ graph. The production pipeline is:

```text
plant preset
    -> developmental organ graph
    -> PlantRenderData adapter
    -> packed worker data
    -> instanced near, mid, and far renderers
```

Each preset combines appearance with a botanical development program. The
program selects one of six architecture families (`rosette`, `clump`,
`upright`, `vine`, `shrub`, or `tree`) and configures its axes, foliage,
phenology, reproduction, storage organ, and special organs. The same graph
builder therefore supports every entry in `plantTypes` while keeping the
species-specific parameters in the preset catalog.

Graphs are deterministic for a plant definition, lifecycle generation, and
seed. Organs have stable identifiers, parent/child relationships, birth and
maturity generations, health, and development stage. Existing organs keep
their sampled traits while later leaves, branches, flowers, fruit, storage
organs, runners, tendrils, and thorns emerge. Rendering is a separate step, so
topology can be generated, tested, cached, and profiled without constructing
Three.js geometry. Definitions may also opt into leaf senescence, which lowers
organ health, warms and contracts the foliage, then removes it at its recorded
death generation.

The unit tests exercise graph integrity and lifecycle stability for all 50
presets. They also verify that mature graphs honor the organ counts requested
by each definition and that every preset produces finite render data.
