# BORN ANOTHER

## Concept Document — Working Direction

**Project type:** Procedural World Building / Interactive Speculative Digital Life  
**Status:** Concept direction for experimentation, not a finalized implementation specification  
**Core medium:** React, Three.js / React Three Fiber, procedural geometry, shaders, rule-based simulation

## 1. Concept Statement

**BORN ANOTHER** is a procedural world inhabited by finite, autonomous digital life forms inspired by organisms that once existed on Earth but are now extinct. Rather than reconstructing prehistoric species literally, the project reimagines them as unfamiliar forms of digital existence.

Visitors encounter a living entity, communicate through language, and observe how their words alter its local environment. Environmental changes spread through space, affecting nearby organisms in different ways. Each life has its own needs, history, growth patterns, and finite lifespan; no single life exists solely to respond to the visitor.

Over time, visitors may discover that the organism they have come to know is part of a wider network of living relationships. When a life ends, its identity and historical origin can be revealed: the speculative digital existence is placed alongside evidence of the real organism that once lived on Earth.

The project asks how we might form a meaningful relationship with a life we cannot fully understand or control—and how that relationship changes when we recognize that the life has a world beyond us.

**Short proposition:** *We encounter it as a life. Only after it disappears do we discover what it once was.*

## 2. Central Questions

1. **Existence:** What makes an artificial organism feel alive rather than merely animated?
2. **Relationship:** Can a visitor form a meaningful connection with a life they cannot fully understand or control?
3. **Interdependence:** How does that relationship change when the visitor discovers the organism is affected by other lives, not only by human interaction?
4. **Mortality and memory:** What changes when a fleeting digital life is connected, after its death, to the history of a real extinct organism?

These are open questions to explore through experience, not claims that the installation has already proven.

## 3. Why Extinct Organisms?

Extinction provides the conceptual starting point: the original biological life is no longer present, but its traces and scientific history remain. BORN ANOTHER proposes an alternative, speculative encounter—not a resurrection, accurate biological reconstruction, or scientific simulation of the extinct ecosystem.

A source organism may inform morphology, growth logic, ecological sensitivities, or behavioral constraints. Its digital counterpart can be abstract and unfamiliar. The visitor should not necessarily know its source identity at first encounter.

Different source organisms may originate from different geological periods. Their coexistence in this digital world is intentionally speculative; it must not be presented as a historically accurate shared habitat.

**Important distinction:** The cause of a digital organism's death in the simulation is not the scientific cause of extinction of its historical counterpart. Historical claims must be evidence-based, qualified where uncertain, and supported by credible sources.

## 4. The World: A Living System, Not a Display of Objects

The procedural world is defined by ongoing relationships between spatial environmental fields, individual organisms, time, and accumulated history.

### 4.1 Spatial environment

Environmental properties such as **temperature** and **moisture** vary by location rather than acting only as global sliders. A disturbance begins locally and gradually diffuses outward, with attenuation and change over time. Additional variables (such as light or stability) are optional and should only be added if they serve a clear behavioral role.

### 4.2 Autonomous lives

Each organism has:
- Its own identity and deterministic seed;
- A finite lifecycle with growth, maturity, decline, and death;
- Individual environmental preferences, sensitivities, and tolerances;
- Procedural morphology and behavior driven by its state and surroundings;
- A record of meaningful environmental and interaction events.

An organism continues to exist and evolve when the visitor does nothing. Its responses are not simply scripted reactions to human commands.

### 4.3 Reciprocal influence

The environment affects organisms, and organisms can in turn affect local environmental conditions. These changes may propagate to neighbors. The aim is a legible, limited feedback system—not a comprehensive ecological simulator.

A second organism is justified only if its independent activity produces a meaningful change in the visitor's understanding of the first organism. **Interdependence, not organism count, is the design goal.**

## 5. Human Interaction: Expression, Influence, and Discovery

The visitor initially approaches an unfamiliar organism through curiosity, not through an assigned duty to keep it alive.

**Interaction chain:**

`Human expression → semantic interpretation → local environmental disturbance → spatial diffusion → autonomous organism responses → visitor observation and interpretation`

The visitor may describe a memory, place, experience, or feeling. An interpretation layer identifies environmental cues where they exist (for example, heat or lack of rain) and translates them into bounded environmental changes near the organism being addressed. Personal or emotional context may be retained as part of interaction history, but should not be converted through simplistic rules such as “sadness = cold.” If no environmental meaning is present, the system should avoid inventing a forced mapping; an optional follow-up prompt can invite a more sensory description.

The organism does not need to speak, understand human language as a person would, or act as a chatbot. Its response is expressed through procedural behavior: membrane movement, crystal growth, spatial orientation, rhythm, or other nonverbal changes.

**Care is not the initial objective.** The first interaction is better described as curiosity, expression, and influence. Care may emerge later if the visitor notices the organism's needs and intentionally tries to improve its conditions. The system should not assume every visitor will become a caretaker.

Environmental conditions can influence vitality, development, or risk of premature decline, but the finite lifespan remains central. Death should not automatically signify user failure, nor should maximizing lifespan become the primary game objective.

## 6. From One Encounter to Interdependence

The initial experience should foreground **one encountered organism (A)**. Another organism (B) may exist nearby and operate independently. The visitor gradually discovers B through environmental or behavioral effects, rather than being introduced to a management dashboard of multiple creatures.

A proposed experiential progression:

1. **Encounter:** The visitor observes A and experiments with language. A behaves according to its own lifecycle and local conditions.
2. **Discovery:** A changes in ways the visitor did not directly cause. The visitor notices B, whose activity affects the shared environment.
3. **Interdependence:** An environmental change near A diffuses outward. It may benefit A but stress B, depending on their different sensitivities. B's independent behavior can also feed back into A's conditions.
4. **Reflection:** The visitor recognizes that knowing or influencing A does not mean owning its life or controlling its world.

This should **not** become a binary “save A or save B” morality game. The visitor can observe, experiment, change their approach, or refrain from intervention. Outcomes emerge from system rules rather than from predetermined moral choices.

**Prototype decision:** Begin with A and B. Add C or more organisms only if testing shows they contribute meaningfully to the experience.

## 7. Independent Lifetimes and Death Rhythm

All organisms share world time but have independent life histories. Their birth or initial age, growth rate, environmental sensitivity, decline, and death may differ. There is no mandatory narrative sequence in which B or C dies before A, or A dies last.

Possible outcomes include:
- B dies before A;
- A dies while B remains alive;
- A's death changes conditions for a surviving neighbor;
- The visitor misses another organism's death entirely.

**Biological time** is the simulation's ongoing lifecycle. **Narrative time** is what the visitor happens to witness. The world should not begin or end solely because the visitor enters or because A dies.

A death can create a moment of focused attention, but other living organisms and environmental processes should continue. A's absence may leave a trace or alter local conditions without implying that neighbors experience human-like grief.

## 8. Death Reveal and Archive

Death is an inevitable aspect of finite digital life and a possible emotional culmination of the visitor's encounter. A fuller reveal is especially appropriate for a life with which the visitor has developed a sustained relationship.

**Proposed full reveal sequence:**

1. Final movement and gradual dissolution;
2. A brief moment of absence or silence;
3. Emergence of the real historical organism's name and geological period;
4. Archival or fossil evidence, with accurate scientific context;
5. A record of this particular digital life—its changing environment, interactions, relationships, and trajectory.

Other organisms also have independent deaths and histories. Their deaths may be shown through quieter, environmental traces, with optional discovery of their identities. **Every life has an archive, but not every death needs to interrupt the visitor with the same cinematic sequence.**

The archive should clearly separate two kinds of history:

| Historical origin | Digital life history |
| --- | --- |
| Verified taxon and geological period | Generated identity and lifespan |
| Fossils or other documented traces | Environmental conditions experienced |
| Known ecology and qualified extinction history | Interactions and effects on neighboring lives |
| Credible scientific references | Distinct procedural growth and decline |

A visitor may continue exploring surviving organisms after the primary encountered life dies. The system should not immediately force a replacement or restart.

## 9. Procedural World Building: Technical and Conceptual Core

The procedural system must do more than create an attractive form. Its rules should generate **form, environment, behavior, and history**.

- **Procedural form:** membrane deformation and crystal growth respond to identity, lifecycle, and environmental state.
- **Procedural environment:** local environmental fields evolve, diffuse, and retain consequences of disturbances.
- **Procedural behavior:** organisms react according to distinct constraints and state, rather than predefined narrative animations.
- **Procedural history:** accumulated events make individual lives and their final records distinct.

The project's procedural logic should remain visible and explainable through controlled experiments: identical seeds with different environmental histories should produce causally interpretable differences. Deterministic replay is valuable for testing and presentation.

## 10. What Already Exists vs. What Remains Proposed

### Existing foundation in World

- A finite AGE-driven lifecycle and deterministic replay;
- Procedural membrane deformation;
- Internal crystal growth and branching systems;
- Local stimulus causing deformation and crystal response;
- Environmental parameters including temperature and moisture;
- Shader and material studies, including translucent membrane and crystalline appearance.

### Proposed / not yet validated as an integrated experience

- Spatial environmental fields with gradual diffusion;
- Organism-to-environment feedback;
- Multiple independently evolving organisms and ecological coupling;
- Language-based semantic interpretation linked to environmental disturbances;
- Relationship or encounter history that informs narrative presentation;
- Full death reveal with verified extinct-organism references;
- A shared archive of historical origins and generated life histories.

This distinction is important: the concept document defines the intended direction, not a claim that all systems are implemented.

## 11. Prototype Strategy and Evaluation

**Experiment 1 — Spatial environment:** Create a localized temperature/moisture disturbance and visualize its diffusion over time. Verify that distance, intensity, and decay behave coherently.

**Experiment 2 — Environment to life:** With one organism, demonstrate how different local environmental histories change growth, vitality, or decline under the same seed.

**Experiment 3 — Reciprocal feedback:** Allow the organism to modify a limited environmental variable and observe whether this produces understandable, stable feedback.

**Experiment 4 — Two-life test:** Add B with distinct sensitivities and independent activity. Determine whether its presence reveals something about A that the single-organism version cannot.

**Experiment 5 — Human expression:** Connect text interpretation to bounded environmental changes; keep the underlying world rules intact and avoid direct emotion-to-animation mapping.

**Experiment 6 — Death and historical reveal:** Prototype the pacing of dissolution, silence, factual historical reveal, and personal life archive without stopping the surrounding world.

**Evaluation questions:**
- Does the visitor perceive A as having a life independent of their actions?
- Can the visitor recognize that B influences A, rather than merely adding visual complexity?
- Does the world remain interesting when the visitor stops interacting?
- Are environmental causes and life responses legible without turning the work into a parameter-management game?
- Does the reveal deepen the meaning of the preceding encounter, rather than feeling like an unrelated information panel?

## 12. Design Principles and Boundaries

1. **Life before interface:** The organisms should feel present before the visitor is asked to operate controls.
2. **Relationship without possession:** The visitor can influence, but not fully direct, another life.
3. **Interdependence without ecological overengineering:** Add only the interactions needed to make coexistence meaningful.
4. **Care as possibility, not obligation:** Curiosity and connection come first; nurturing is not a mandatory game loop.
5. **Mortality without failure:** Death is part of the world's temporal structure, not necessarily a punishment.
6. **Scientific origin, speculative existence:** Keep documented extinct-species facts separate from invented digital behavior.
7. **Procedural causality:** Important changes should follow coherent rules, not arbitrary visual triggers.
8. **The world continues:** No single organism, including the visitor's main encounter, is the center of all life.

## 13. Open Decisions

- Which extinct taxon or taxa will provide the first defensible biological references?
- Which environmental variables are essential for the initial simulation?
- How should the visitor discover B without weakening the intimacy of A?
- What behaviors should organisms use to influence their environment?
- What determines the degree of narrative focus at death without reducing relationship to a visible score?
- How should time be paced so that growth, discovery, decline, and reveal can occur within a feasible exhibition or critique session?
- What is the minimum viable archive, and how will fossil images and scientific sources be credited?

## 14. One-Paragraph Presentation Summary

**BORN ANOTHER** is a speculative procedural world where extinct organisms are reimagined as finite digital lives. A visitor first encounters one unfamiliar organism and communicates through language, which subtly changes its local environment. As those changes spread, the visitor may discover other autonomous lives whose needs and behaviors are connected to the first. The experience moves from curiosity about an individual organism toward an awareness of coexistence, influence, and limits of control. Each organism follows its own lifecycle, and death does not stop the world. Only after a life disappears may its real historical origin be revealed alongside the unique history it generated in this digital world. Rather than recreating extinct species, BORN ANOTHER asks what it means to encounter, relate to, and remember a life that exists beyond us.
