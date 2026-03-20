# UI Review Report

Source footage:
`c:\Users\Ojas\Videos\Screen Recordings\Screen Recording 2026-03-20 144644.mp4`

Analysis basis:
- video length: ~22.8s
- sampled contact sheets and extracted frames from the recording
- review focused on first-use experience, clarity, motion, hierarchy, and failure states

## Overall Read

The new visual direction is strong. The dark shell, left workspace rail, premium typography, and hero direction all feel much better than the older UI.

The biggest problem is not the art direction. It is the product experience visible in the recording:
- the backend is offline, so the app feels broken very quickly
- multiple screens show large blank or near-blank panels
- the hero is visually strong but takes too much of the first impression before functional value shows up
- failure and loading states are too dominant compared to successful/productive states

In short:
the app looks better, but the recording still feels fragile.

## What Is Working

- The top-level shell looks premium and cohesive.
- The left navigation is clear and readable.
- The typography and panel system are much stronger than before.
- The hero establishes a real visual identity.
- The Assets Lab layout is structurally solid.

## Main Issues

### 1. Offline state dominates the experience
Priority: Critical

Observed in the recording:
- top-right status shows `Backend offline`
- a full-width red error banner appears below the hero
- `Request failed: Network Error` also appears inside the workspace

Why this hurts:
- the app immediately feels broken
- the same failure is communicated in 2-3 places
- users are pushed into an error-reading experience instead of a product experience

What to change:
- create one unified offline state
- replace duplicate per-tab network errors with a shared global connection surface
- show one clear CTA:
  `Start backend` or `Reconnect`
- when offline, disable backend-dependent controls and explain why
- optionally show demo/sample content instead of empty broken panels

### 2. Tab switching still produces large dead space
Priority: High

Observed in the recording:
- several moments show a huge dark workspace panel with almost no content
- `Loading experiment history` is centered in a mostly empty screen
- Search Studio appears blank for a moment

Why this hurts:
- the app feels slower than it is
- the premium shell turns into a large empty rectangle
- motion cannot compensate for lack of perceived progress

What to change:
- keep previous tab content visible until the next tab is ready
- use section skeletons instead of full empty panel loading
- add per-module loading placeholders that match final layout
- avoid clearing the whole right pane during fetches

### 3. Hero takes too much of the first screen
Priority: High

Observed in the recording:
- the hero dominates the opening view
- the real workspace content starts well below the fold
- users must move past branding before seeing useful controls

Why this hurts:
- the app reads more like a landing page than a working tool
- first-use utility is delayed
- the strong visuals compete with task discovery

What to change:
- reduce hero height by roughly 20-30%
- tighten hero copy and spacing
- bring the workspace shell higher on desktop
- consider a collapsible or shorter hero after first load

### 4. Error messaging is visually too heavy
Priority: High

Observed in the recording:
- the offline banner is large and highly saturated
- module-level error bars use similar styling and stack visually

Why this hurts:
- error color takes over the screen
- the UI feels alarming rather than informative
- there is no clear hierarchy between status, warning, and failure

What to change:
- tone down the offline banner visually
- make it thinner and more action-oriented
- differentiate:
  - global connection status
  - local request failure
  - empty state
- reserve the strongest red treatment for destructive or unrecoverable failures

### 5. Native file inputs break the premium design system
Priority: Medium

Observed in the recording:
- the white native `Choose File` controls stand out sharply against the dark shell

Why this hurts:
- they look unfinished
- they break immersion
- they make the form area feel browser-default rather than product-designed

What to change:
- replace native-looking file inputs with custom upload fields
- use drag-and-drop or a styled trigger button
- show selected file name in a branded input shell

### 6. Empty states feel too empty
Priority: Medium

Observed in the recording:
- large table areas show `No datasets uploaded yet` in the middle of a big dark block
- the Command Center loading state also feels sparse

Why this hurts:
- the app feels inactive
- zero-state screens do not teach the user what to do next
- the right panel looks visually unfinished

What to change:
- add richer empty states with:
  - icon/illustration
  - one-line explanation
  - one primary action
  - one secondary hint
- reduce the amount of dead vertical space
- use placeholder rows/cards to imply the final layout

### 7. Hero 3D scene needs a stronger focal payoff
Priority: Medium

Observed in the recording:
- the hero visual is atmospheric, but still reads a little empty in motion
- the floating chips and lines are subtle, but the centerpiece does not fully command attention

Why this hurts:
- the left half feels lighter than the right text block
- the scene does not yet earn all the space it occupies

What to change:
- enlarge the core chip object slightly
- strengthen the glow/lighting around the focal object
- reduce empty void space around the scene
- make the support labels more deliberate or fewer in number

### 8. Functional tabs need stronger action hierarchy
Priority: Medium

Observed in the recording:
- forms are readable, but the eye doesn’t always land on the main action first
- some sections feel like they are waiting for content rather than guiding input

Why this hurts:
- the shell feels premium, but the workflow still feels somewhat passive
- users have to scan more than they should

What to change:
- strengthen the primary CTA in each workspace
- add short “next step” guidance near the action button
- group supportive copy more tightly around inputs

### 9. Too many “zero” values are visible at once
Priority: Medium

Observed in the recording:
- models: `0`
- datasets: `0`
- hero stat cards: `0`
- many empty tables

Why this hurts:
- the app feels lifeless during first-run
- the polished visuals do not translate into perceived capability

What to change:
- seed the UI with safe sample/demo values when no assets exist
- or replace zeros with setup-oriented messaging
- example:
  `No models yet` is often better than a lonely `0`

### 10. Copy density can be trimmed
Priority: Low

Observed in the recording:
- some descriptive text blocks are longer than needed
- in dark UI, medium-length copy can feel heavier than expected

Why this hurts:
- slows scanning
- makes forms and cards feel denser

What to change:
- shorten explanatory copy by 15-25%
- keep one clear sentence per section where possible

## Recommended Action Order

### Phase 1: Fix first-use trust

1. Unify offline/error handling into one global connection state.
2. Remove duplicate failure banners inside tabs when the app is globally offline.
3. Add proper skeletons or preserve previous content during tab transitions.

### Phase 2: Improve first screen usefulness

1. Shorten the hero.
2. Pull the workspace shell higher.
3. Strengthen the default active workspace view with sample structure.

### Phase 3: Polish functional surfaces

1. Replace native file inputs with custom upload controls.
2. Improve empty states and first-run guidance.
3. Strengthen CTA hierarchy in Experiment Builder, Search Studio, and Assets Lab.

### Phase 4: Final visual refinement

1. Tighten the 3D hero focal point.
2. Reduce visual emptiness in large dark panel areas.
3. Tune spacing and copy density.

## Bottom Line

The design direction is good.

The recording shows that the next step is not “more decoration.” The next step is making the app feel reliable and alive when data is missing, when the backend is offline, and when modules are still loading.

If those states are fixed, the premium UI work will land much more convincingly.
