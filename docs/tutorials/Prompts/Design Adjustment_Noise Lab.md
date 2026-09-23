http://localhost:5175/
## Change side bar
Refactor the page into a consistent two-column workspace layout across all three views.

Layout:
- Use a large visualization canvas on the left.
- Move all adjustable controls and sliders into a fixed-width control panel on the right.
- The left visualization should fill all remaining available width and height except for the title and the margin space of the page.
- Keep the header compact, with the Noise Lab title on the left and the main navigation tabs on the right.
- Remove the current bottom control section after its controls have been moved to the right panel.

Right control panel:
- Use a width of approximately 320–360px. (the size could auto change on different )
- Make it independently scrollable if the controls exceed the viewport height.
- Organize controls into clear sections such as Noise, Grid, Shaping, Geometry, and Simulation.
- Only show Geometry controls in relevant 3D views.
- Only show Simulation controls in the Simulation view.
- Keep the section headers, sliders, values, spacing, and borders consistent.

Main visualization:
- Allow the 2D map and 3D terrain to use as much of the remaining space as possible.
- Preserve the square aspect ratio of the 2D map.
- Resize the Three.js canvas responsively when the panel width or browser size changes.
- Do not crop or distort the visualization.

Important:
- Preserve all existing state variables, parameter ranges, calculations, and interactions.
- Do not change the noise-generation, terrain, particle, or animation logic.
- Do not redesign individual sliders yet.
- First inspect the existing component structure and styles.
- Make the smallest necessary changes and do not modify unrelated code.


### Followup Change in detail 
- Refine the UI hierarchy and styling without changing the existing functionality:


1. make the noise lab title a little bigger
2. Move the viewport tabs from the top-right of the main view to the top-left.
3. Style the viewport tabs like compact folder/browser tabs:
   - Sharp 90-degree corners
   - No rounded corners, bevels, or diagonal edges
   - Active tab: magenta background with white text
   - Inactive tabs: black background with a thin gray border
3. Make the viewport tabs (`2D MAP / 3D WORLD`) smaller and more compact than the top-right page navigation.
4. Make the top-right page navigation (`2D MAP / 3D WORLD / SIMULATION MAP`) slightly larger and more prominent.
5. Increase the size and clarity of all UI labels slightly, while keeping the font thin and crisp.
6. Increase the main `Noise Lab` title size.
7. Change all slider handles to magenta while keeping the slider tracks gray.
8. In 3D World mode, keep the floating 2D preview open by default and position it on the left, directly below the viewport tabs.

Preserve the existing black industrial visual style, layout proportions, interactions, and functionality. 


## Refine 3D view
Improve the 3D terrain rendering while preserving the existing terrain generation, controls, camera behavior, and page layout.

1. Add three display modes:
   - `SOLID`
   - `WIREFRAME`
   - `SOLID + WIREFRAME`

2. Rendering behavior:
   - `SOLID`: display the existing white terrain with improved lighting.
   - `WIREFRAME`: display only thin, semi-transparent light-gray wireframe lines.
   - `SOLID + WIREFRAME`: display the white solid terrain with a subtle dark-gray wireframe overlay. Keep the overlay low-opacity so it does not look too dense.

3. Improve the lighting:
   - Add one clear directional light positioned diagonally above the terrain.
   - Add a very weak ambient light so shadowed areas are still visible.
   - Keep the lighting neutral.
   - Avoid overexposed white surfaces and completely black shadows.
   - Recompute vertex normals if needed to improve surface definition.

4. UI styling:
   - Place the three modes in the existing viewport tab area.
   - Keep the tabs compact with sharp 90-degree corners.
   - Active mode: `#ff1493` background with white text.
   - Inactive modes: black background, subtle gray border, light-gray text.
   - Center all labels vertically and horizontally.
   - Use consistent `1px` borders.

5. Implementation:
   - Switching modes must not regenerate or reset the terrain.
   - Preserve the current camera position and noise settings.
   - Reuse the existing terrain geometry.
   - Avoid creating duplicate meshes or animation loops.
   - Properly dispose of replaced materials or overlay objects.

Do not add `HEIGHT GRADIENT`, `AXIS`, `GRID`, or `RESET CAMERA` yet. Do not change any unrelated UI or functionality.

2.
Add compact viewport tools to the existing 3D terrain view without changing the terrain rendering modes or generation logic.

1. Add three secondary controls:
   - `AXIS`
   - `GRID`
   - `RESET CAMERA`

2. Behavior:
   - `AXIS` toggles the Three.js AxesHelper on and off.
   - `GRID` toggles the existing grid on and off.
   - `RESET CAMERA` restores the original camera position, rotation, zoom, and OrbitControls target.
   - Set the initial state to: AXIS off and GRID on.
   - Preserve the terrain, noise settings, and selected display mode when using these controls.

3. Camera reset:
   - Store the initial camera position and OrbitControls target.
   - Reset both the camera and controls target.
   - Call `camera.updateProjectionMatrix()` and `controls.update()` after resetting.
   - Do not recreate the scene, terrain, renderer, or controls.

4. UI:
   - Place these controls near the existing display-mode tabs, but keep them visually secondary.
   - Use compact sizing, centered labels, sharp 90-degree corners, and consistent `1px` borders.
   - Active AXIS/GRID toggle: `#ff1493` border and text.
   - Inactive toggle and RESET CAMERA: black background, subtle gray border, light-gray text.
   - Do not use a solid magenta background for these secondary controls.

5. Implementation:
   - Reuse one AxesHelper and the existing grid instead of recreating them on each toggle.
   - Do not create additional animation loops.
   - Clean up the AxesHelper if the component unmounts.

Do not add `HEIGHT GRADIENT` yet. Do not modify unrelated UI, lighting, materials, or simulation behavior.


## Homepage
Please refine the landing page layout based on the attached screenshots.

The first image is the current landing page. Use the second image only as a visual reference for the organic, open-ended boundary of the particle field.

1. Right-side visualization
- Remove the obvious rectangular boundary around the animated particle visualization.
- Make the particle field feel organic, irregular, and open-ended, similar to the second reference image.
- Let particles extend naturally toward different areas instead of filling a clearly defined rectangle.
- Use a soft, uneven fade near the outer edges so the visualization blends seamlessly into the black background.
- Avoid a visible container border, hard rectangular clipping, or a simple rounded rectangle.
- Preserve the existing particle animation, colors, and interaction logic.

2. Left content
- Reduce the page’s left padding slightly so the content sits closer to the left edge.
- Keep the title, description, and Enter button aligned to the same vertical axis.
- Preserve enough whitespace so the layout still feels balanced and intentional.

3. Simplify the information
- Remove the FIELD / OPERATOR information block below the description, including its divider line.
- Remove the small formula text below the Enter button.
- The bottom action area should contain only the ENTER button.

4. Enter button placement
- Reposition the ENTER button so it feels clearly connected to the title and description.
- Do not place it too close to the bottom edge.
- Give it comfortable spacing above and below and keep it aligned with the left text column.
- It should remain visually prominent without appearing isolated.

5. Overall composition
- Rebalance the page after removing the secondary information.
- The left side should feel compact and structured, while the visualization remains the dominant element.
- Maintain the current black, white, and magenta visual language.
- Keep the layout responsive and visually comfortable at different screen sizes.

Implementation guidance:
- Prefer a CSS mask with layered radial gradients, or an equivalent soft alpha fade, to dissolve the visualization edges organically.
- Do not use a single rectangular gradient or a hard clip-path that still reveals the canvas shape.
- Keep the canvas/container technically rectangular if needed, but make its visual boundary invisible.
- Do not change the visualization algorithm, navigation behavior, or unrelated components.

First inspect the current landing-page component and styles. Make the smallest necessary changes and briefly summarize which files were modified.

## Add Noise Option

## Add simulation display mode
Add a “BACKGROUND VIEW” control to the Simulation Map panel.

Provide two display modes:
- PARTICLES ONLY
- PARTICLES + 2D MAP

When “PARTICLES + 2D MAP” is selected, render the existing 2D noise map as a background layer beneath the animated particles. Reuse the same 2D map style and noise data shown on the main 2D Map page.

Requirements:
- The 2D map and particles must use the same noise type, parameters, resolution, and Evolve value.
- The background map should update continuously while the simulation is running.
- Keep the particles clearly visible above the map by slightly reducing the map’s opacity or contrast.
- Do not duplicate the noise-generation logic.
- Do not change the existing particle behavior, Start/Pause/Reset controls, or animation loop.


## Add Export Button
Add an Export control to the 3D viewport.

- Place `EXPORT ↓` at the top-right inside the main visualization area, below the VIEW / DISPLAY bar.
- Keep it visually separate from view controls and the right parameter panel.
- Use the existing thin-line technical UI style. No bright fill by default; use #ff1493 only for hover/active states.
- Clicking Export opens a compact dropdown:

PNG Image
Height Map
3D Mesh (OBJ)
3D Mesh (GLTF)

- Align the dropdown to the right edge of the Export button.
- Keep it compact so it does not cover much of the visualization.
- Preserve the current layout and all existing functionality.


## Optimize 3D view 
Improve the 3D terrain SOLID mode only. Keep the current layout and geometry unchanged.

- Reduce the flat gray/clay-like appearance.
- Use soft ambient light + stronger directional light to improve depth and ridge definition.
- Add subtle grayscale height-based shading: darker at low elevations, lighter at high elevations.
- Add a very subtle #ff1493 highlight only near the highest elevations.
- Keep the look abstract, technical, and minimal — not photorealistic.
- Preserve existing Wireframe and Solid + Wireframe modes.


## Add Hydrate Erosion
1.Add a new "Hydraulic Erosion" simulation mode.
Reuse the existing noise height map as the terrain input.
When Hydraulic Erosion starts, create a separate copy of the current height map for simulation.

Do not modify the original noise map.
Do not implement erosion or water particles yet.
Keep the existing 2D/3D views and other simulations unchanged.



2.Add two display modes to the 2D Map:

DOT FIELD | HEIGHT MAP

- Keep DOT FIELD as the current visualization.
- HEIGHT MAP should render the same noise data as a continuous grayscale height field.
- Map low values to black and high values to white.
- Both views must use the same noise parameters and update together.
- Switching views should not regenerate or change the underlying noise data.
- Match the existing Noise Lab UI style.

3.Connect the 2D Height Map and 3D Terrain to the same height-field data.

- Use one shared height array as the source of truth.
- 2D Height Map visualizes the height values as grayscale.
- 3D Terrain uses the same values for vertex elevation.
- Any future change to the height field should update both views.
- Preserve the current UI and controls.

4.Add water droplets to Hydraulic Erosion.

Spawn droplets at random positions on the current height map.
Each droplet should store:
- position
- velocity
- water
- sediment

Visualize the droplets as small particles over the 2D terrain map.

Do not modify the terrain yet.


## Create shader problem
Add height-based shading to the 3D terrain SOLID mode.

- Drive surface color from each vertex's height.
- Low elevations: dark gray.
- Mid elevations: medium gray.
- High elevations: light gray.
- Highest elevations: subtle #ff1493 accent.
- Use smooth interpolation between height ranges.
- Keep directional lighting so terrain depth remains visible.
- Update the shader automatically when terrain height changes.
- Preserve Wireframe and Solid + Wireframe modes.


## Add Color
-Add a BIOME display mode to the existing 3D terrain.

Map terrain elevation to these colors:
- Deep water: #161A24
- Shallow water: #30384D
- Lowland: #726B79
- Highland: #A18491
- Rock: #B8A8AE
- Snow / highest peaks: #F1ECEF

Use smooth blending between elevation zones instead of hard bands.

Use #FF1493 very sparingly as an accent for selected/highlighted terrain features, not as a main biome color.

Add a Water Level control to adjust the lake threshold.

Keep the existing noise, terrain geometry, lighting, and other display modes unchanged.

## Revise Color
Refine the BIOME terrain visualization.

The current terrain looks too soft and pink, and the biome zones are difficult to distinguish.

1. Keep most terrain neutral and dark:
- lowland: #4A4D5A
- highland: #726B79
- rock: #A39AA1
- peaks: #E8E5E7

2. Reduce pink/mauve coverage significantly.
Use #FF1493 only as a subtle accent, not as a terrain base color.

3. Add a separate horizontal water plane at the Water Level instead of coloring low terrain as water.
Use #161A24 for water with slight transparency.

4. Keep smooth transitions between terrain zones, but make each biome visually distinguishable.

5. Increase terrain surface definition slightly so ridges and valleys are easier to read.

Keep the existing geometry and noise generation unchanged.




-Replace the pure black 3D viewport background with a subtle atmospheric gradient.

Palette:
- top: #11131B
- center: #1D1B26
- bottom: #29232B

Blend dark blue-gray into dusty mauve-gray.

Add a very subtle radial glow behind the terrain so the center is slightly lighter than the edges.

Keep it dark, low-saturation and minimal.
Avoid obvious gradient bands or bright pink.
Keep #FF1493 as the main accent color.









