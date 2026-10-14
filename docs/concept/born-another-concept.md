---
aliases:
- Artificial Life
- A World That Remembers
area: Procedural World Building
status: developing
tags:
- concept
- procedural-design
- artificial-life
- temporality
- memory
- lineage
title: Born Another
type: concept
updated: 2026-09-23
---

# Concept --- Born Another

## In one breath

A procedural system in which the user chooses the initial conditions for
an artificial digital life rather than directly designing its final
form. The entity develops autonomously, exists for a finite lifespan,
and eventually dies. The user cannot prevent its death, but can choose
which moments of its existence are worth preserving.

## Conceptual Origin — Blade Runner (1982)

The project is conceptually inspired by the replicants in *Blade Runner*
(1982). The reference is to their condition as artificial lives, not to
the film's visual aesthetic.

![[blade-runner-1982-roy-batty.jpeg]]

Roy Batty, a replicant, in the last moments of a lifespan built into his
existence. *Blade Runner* (1982), directed by Ridley Scott. He is about
to disappear, and the experiences that made this life his own will
disappear with him.

**Artificial life and finite lifespan.** Replicants are artificial
beings whose limited lifespan is built into their existence from the
beginning. This suggests a generated digital entity that is created
knowing it will eventually disappear.

**Artificial life and identity.** A replicated life begins from existing
information. If something is made from what came before, what makes it
an individual rather than simply a copy?

Born Another explores these questions through abstract procedural
entities rather than human-like characters:

> **If something begins from inherited information, when does it become
> itself?**

> **If an artificial life is designed to disappear, which moment of its
> existence is worth preserving?**

Each entity may inherit traces from previous entities, but develops
differently through its own finite existence. Its individuality emerges
through inheritance, variation, development, and memory.

**Creation → Inheritance → Individuality → Life → Death → Memory → New Life**

## Why it exists in this project

Most generative systems focus on producing a final result: set
parameters, generate an object, and keep the preferred output.

This project shifts the focus from **generating an object** to
**observing a life**.

The generated form is not treated as a finished design. It is a
temporary entity with its own history. Its form changes through time,
and no single stage is necessarily the "final" or "best" version.

The central question becomes:

> **If an artificial object is designed to disappear, which moment of
> its existence is worth preserving?**

## Core relationship

The user does not directly design the object.

Instead:

**User chooses conditions → System interprets them → Artificial life
emerges**

The user influences the beginning, but does not fully control the
outcome.

This distinction is important:

-   **Customization** means choosing the desired form.
-   **Procedural generation** means choosing conditions from which an
    unpredictable form can emerge.

The project is interested in the second relationship.

## A finite life

Each generated entity has a limited lifespan.

Its existence unfolds through time rather than appearing immediately as
a finished object:

**Birth → Development → Maturity → Instability → Decay → Death → Trace**

Death is not a failure state or a reset. It is part of the system from
the moment the entity is created.

The user may influence or observe the entity, but cannot make it
permanent.

## Preserve a moment

Because the entity will eventually disappear, preservation becomes the
central user interaction.

At any point during its lifespan, the user can choose to:

> **Preserve This Moment**

A preserved state is not a separate generated design. It is a record of
the same entity at a particular age.

For example:

**Birth ───── ● ───────── ● ───── ● ───── Death**\
　　　　　　Moment 01　 Moment 02　 Moment 03

The preserved moments together document the entity's life rather than
forming a conventional gallery of unrelated outputs.

The project therefore asks the user to make a temporal choice:

> **Not "Which object do I want?" but "Which moment do I want to
> remember?"**

## Memory after death

Death does not necessarily mean complete erasure.

After an entity disappears, it can leave behind a **trace** or
**memory** within the system.

This trace may influence what comes next.

The system therefore remembers entities that are no longer present:

**Life → Death → Trace → Memory → Future Life**

The visible world at any moment can contain the consequences of things
that no longer exist.

## Lineage

New entities do not have to begin from a completely blank state.

A later entity may inherit partial information from an earlier one.
Through inheritance, variation, and change, entities can form a lineage:

``` text
              Entity 001
                  │
          ┌───────┴───────┐
      Entity 002       Entity 003
          │
      Entity 004
          │
      ┌───┴───┐
 Entity 005  Entity 006
```

This changes the collection from a gallery of independent generated
objects into a record of **relationships across generations**.

Each entity can be unique while still carrying traces of what existed
before it.

Inheritance is not only a generative mechanism. It also creates a
question of identity: how much of an entity comes from what it inherits,
and how much emerges through its own development?

## The world remembers

The larger system is therefore constructed through accumulated histories
rather than isolated outputs.

An entity exists temporarily.

A moment can be preserved.

The entity dies.

A trace remains.

Something new inherits from that trace.

Over time, the system develops its own history.

> **The world remembers what has disappeared.**

## Role of the user

The user is neither a traditional designer nor a passive viewer.

The user:

-   chooses initial conditions;
-   initiates a life without determining its final form;
-   observes its autonomous development;
-   decides which moments are worth preserving;
-   encounters later entities that may carry traces of earlier
    generations.

The system retains control over lifespan, transformation, and eventual
death.

## Conceptual tensions

The project explores several relationships:

  -----------------------------------------------------------------------
  Tension                             Question
  ----------------------------------- -----------------------------------
  Control ↔ Emergence                 How much can the user influence
                                      without directly designing the
                                      outcome?

  Temporary ↔ Preserved               What becomes valuable when the
                                      original cannot remain?

  Life ↔ Death                        What changes when disappearance is
                                      designed into the system?

  Individual ↔ Lineage                How much of an entity comes from
                                      what it inherits, and how much
                                      emerges as its own through
                                      development?

  Presence ↔ Memory                   Can something continue to affect
                                      the system after it is gone?

  Artificial ↔ Living                 When does a generated object begin
                                      to feel like an entity rather than
                                      a form?
  -----------------------------------------------------------------------

## Visual direction

The entity should remain visually ambiguous rather than representing a
recognizable organism, building, or object.

Possible qualities include:

-   organic but synthetic;
-   incomplete or unstable boundaries;
-   translucent or layered materiality;
-   particles and continuous surfaces;
-   traces, fragments, and residues;
-   forms that feel somewhere between organism, mineral, data, and
    artifact.

The visual language should support the ambiguity between **generated
object** and **artificial life**.

## AI as an Interpreter of Initial Conditions

This section explores a possible role for AI. It is not yet a finalized
feature.

The user may begin a new life by entering a short piece of text. That
text should **not** function as a conventional text-to-3D prompt. The
user should not be able to describe or request the final appearance of
the organism.

### Chain of influence

**User Text → AI Interpretation → Latent Life Conditions → Procedural
System → Artificial Life**

AI acts as an **interpreter** between subjective human language and the
procedural life system—not as the author or generator of the organism.

### What the text does not do

A line such as:

> "I remember a place that no longer exists."

should not directly produce a nostalgic-looking or otherwise specific
3D form. Language does not become a blueprint for appearance.

### What the text may become

AI may interpret the text into abstract **life conditions**, for
example:

-   structural stability;
-   growth tendency;
-   symmetry bias;
-   mutation tendency;
-   circulation intensity;
-   attachment / release tendency;
-   lifespan characteristics;
-   decay behavior.

These conditions then influence the existing procedural systems without
directly determining their outcome. Procedural uncertainty remains: the
same text should not necessarily produce the same organism.

### Who owns the form

**Form = Initial Conditions × Individual Seed × Age × User Intervention**

| Influence | Role |
|-----------|------|
| **AI interpretation** | Provides initial conditions from language |
| **Seed** | Individuality and chance |
| **AGE** | Autonomous development and mortality |
| **User intervention** (e.g. Path) | Influence after birth |
| **Procedural system** | Responsible for the actual form |

This keeps the existing principle:

> **The user influences the beginning, but does not fully control the
> outcome.**

And suggests a related conceptual line:

> **The user gives a life its origin, but not its form.**

### Why AI belongs conceptually

AI allows subjective human language to become ambiguous initial
conditions for an artificial life without giving the user direct control
over its final form. Interpretation serves the life system; it does not
replace procedural emergence.

### Origin as history

The original text may become part of the life record alongside birth,
interventions, preserved moments, and death—rather than remaining a
disposable generation prompt.

Example:

```
LIFE #027

Origin:
"I remember a place that no longer exists."

Birth
↓
Development
↓
User Interventions
↓
Preserved Moment
↓
Death
```

The text then belongs to the organism's history and possible lineage,
not only to the moment of generation.

## What is intentionally unresolved

The specific procedural rules are not defined yet.

Future exploration will determine:

-   what initial conditions the user can choose;
-   what internal forces drive development;
-   how lifespan is determined;
-   how an entity transitions between life stages;
-   what information survives as a trace;
-   what can be inherited by later generations;
-   how much randomness, mutation, and environmental influence should
    exist;
-   whether text input becomes the primary way of defining initial
    conditions;
-   which procedural parameters AI is allowed to influence;
-   how much semantic interpretation should be visible to the user;
-   how much variation should exist between organisms generated from the
    same text;
-   whether the original text survives as part of the organism's trace
    or lineage.

These rules should be developed only after the conceptual relationship
between **life, time, preservation, memory, and lineage** is maintained.

## Key terms

**Born Another** --- A generated entity whose existence is
intentionally limited in time.

**Initial Conditions** --- User-defined conditions that influence
generation without specifying the final form.

**Emergence** --- Form or behavior that results from interacting rules
rather than direct design.

**Lifespan** --- The finite duration of an entity's existence.

**Preserved Moment** --- A saved state of an entity at a specific point
in its life.

**Trace** --- Information or residue that remains after an entity dies.

**Memory** --- The system's ability to retain consequences of entities
that no longer exist.

**Inheritance** --- Transfer of partial information from an earlier
entity to a later one.

**Lineage** --- A sequence or network of related entities connected
through inheritance.

## Current concept statement

> **A procedural system for cultivating finite artificial digital lives.
> The user chooses the conditions from which an entity emerges, but does
> not directly design its final form. An entity may begin with inherited
> information and develop into an individual state through its own
> lifetime. It exists for a limited lifespan and eventually disappears.
> The user cannot prevent its death, but can choose moments worth
> preserving. After death, traces of the entity can remain within the
> system and influence later generations, creating lineage and allowing
> the system to remember what has disappeared.**
