# Sketchling

An AI drawing teacher. Upload a photo of your drawing and the reference you drew from; the teacher lines them up and develops your actual drawing in layers.

## Layers of teaching (current)

Optional **Voice guidance** appears above the lesson checklist. Pick a voice and use **Preview voice** to hear it, then turn guidance on before Start lesson. The color legend is narrated once per lesson; later narration focuses on each edit. Pause / Resume also pauses / resumes speech; changing uploads, restarting analysis, exiting the lesson or changing stages cancels old narration. Turning voice off stops speech immediately. Enabling it midway through a lesson narrates subsequent steps. Audio is browser text-to-speech, with no additional API key or paid narration service. Voices depend on the browser/device. If speech is unsupported, fails, or does not finish, the visual lesson remains available. Voice starts off on each page load. Browser audio has not been auditioned in this environment; automated tests use a mocked speech service.

After **Analyze drawing** and the line-up, the sidebar shows the teacher's checklist for **V1 · Shape and proportion**. Press **Start lesson**: the teacher works through the list one item at a time on a copy of your drawing, then stops at the end of the stage. **Pause / Resume** at any time. The toolbar's stage tabs switch between **Original · V1 · V2 · V3 · Reference** at the same zoom. Clicking a checklist item zooms to that area.

- **One plan drives everything.** Each item is a measured move from where your line is to where the lined-up reference puts it. The checklist wording, the arrows, the pencil's path and the changed pixels all come from that same move (`public/lesson.js`).
- **Your pixels, moved.** V1 is your own drawing with marks warped into place inside the feature's area; nothing is generated, and everything outside the listed areas is unchanged.
- **Amounts in eye-widths**, the unit artists measure a face with.
- **✓ means demonstrated**, not that you've learned it or that it's checked on paper.
- **Only clear measurements are used.** A feature is listed when the fit is confident and the move is larger than ~3% of the face but smaller than a third of the feature. A plain shift is preferred unless a size change fits clearly better; resizes over ~20% fall back to the shift; and only the part of a shift that the feature's edges can show is used (an ear's vertical edges can't show vertical movement). If nothing qualifies, **Start lesson walks through the checks** instead: each feature is zoomed with your line (rust) beside the reference's (green) and ticked with its measured difference in eye-widths, and V1 stays identical to your drawing. **Show smaller differences** lowers the bar to about an eighth of an eye-width; those items are labeled "small, could be measurement noise".
- **Each run of the stage starts from the original**, so V1 is exactly the listed edits.

Validation: `npm test` runs 11 files, including `tests/lesson-plan.test.mjs` (warp locality and progress, wording, tool path, selection, aperture rule, resize limit). On the real portrait photo with the reference, V1 correctly listed nothing: every feature was within about a quarter eye-width. With two errors planted in that photo (mouth 3 units too high, right ear 3 units too far out), V1 listed exactly "Lower the mouth" and "Move the right ear inward", measured about 2 units each (under-corrections, not overshoots), and changed pixels only in those two areas. Hair is excluded. Accuracy still depends on the line-up and on the model's rough outline of each feature on the reference.

### V2 · Light and shadow

When V1 finishes, press **Start V2 · Light and shadow**. V2 starts from V1's pixels and really shades them:

- **Where to shade comes from the reference, in your drawing's own range.** Inside the face and hair outlines, the reference's tonal order (lightest to darkest) is mapped onto the range of values your drawing already uses, so a darker paper photo or softer pencil doesn't read as "everything is wrong". The difference from your drawing is smoothed, and the four largest connected areas that differ by more than about 7% become the checklist ("Darken the hair on the right", "Lift graphite on the forehead", "Lift graphite under the left eye"), named by the nearest feature.
- **Same plan, same pixels.** Each item's area, its amount ("About 1.5 tone steps darker · HB, light layers") and the pencil or eraser path all come from one tone edit. The pencil lays hatch strokes that reveal graphite with paper grain inside the area; the eraser lifts toward the paper. A final pass lands exactly on the planned result, so the V2 tab always shows what was demonstrated and nothing outside the listed areas changes.
- **Caveat:** uneven lighting in your photo of the drawing can look like a tone difference. Compare V1, V2 and Reference before shading on paper.

Validation: `tests/lesson-tone.test.mjs` checks darken/lift placement on synthetic drawings, wording, that changes stay inside the planned area, lift direction, stroke and stamp bounds, and placement names. On the real portrait V2 listed four plausible areas (hair right and left darker, forehead and under the left eye lighter) with no errors. 

### V3 · Details and finishing

When V2 finishes, press **Start V3 · Details and finishing** (or **Skip to V3** if V2 had nothing to change). V3 starts from V2's pixels and works on a finer grid (two cells per sheet unit). It only looks at small-scale structure: a local high-pass removes the broad tone V2 already settled. There are five kinds of item, taught in this order:

- **Blend the marks** (blending stump): where your hatching is busy but the reference is smooth all around, and the marks don't follow an edge the reference also has. The stump makes small circles and the marks are averaged with their neighbours, fading out at the edge of the area.
- **Add the shadow** (HB, light layers): a long dark band about a unit or more wide, such as the shadow under the lower lip.
- **Sharpen the edge** (2B, sharp point): a long thin dark line in the reference, such as the line between the lips. The pencil draws it twice along its length.
- **Add a dark accent** (2B): a small dark among the reference's darkest tenth, such as a pupil or a nostril.
- **Pick out a highlight** (kneaded eraser): a small light among the reference's lightest tenth, lifted toward the paper.

What keeps it honest:

- **Only what your drawing doesn't already have.** Before an accent or highlight is listed, the drawing is checked for a mark at least halfway to that value covering most of that shape, within half its own size (at most a unit). So a pupil drawn a little off isn't drawn twice.
- **Places it stays out of:**
  - the hair and the area just under the hairline
  - the face's outer edge
  - anywhere the reference and the drawing disagree about whether it's skin
  - eyes, brows and lips, which are never blended
- **Same plan, same pixels.** The outline, the tool's path and the changed pixels come from the same item, as in V2.
- **Wording names the place:** between the eyes, the bridge of the nose, temple, cheek, the corners of the mouth, between the lips, under the lower lip.

Validation: `tests/lesson-detail.test.mjs` builds a synthetic face. It checks that:

- a missing pupil, a nose-tip highlight, a lip line, a shadow under the nose and a scribbly patch are each found as the right kind, in the right place and in the right order
- a pupil drawn one unit off isn't drawn twice
- nothing is added to the hair
- a drawing whose details already match gets no items
- each item's pixels change only near its area and in the planned direction
- the tool stays on the area

On the real portrait, V3 listed blending on both cheeks, the shadow under the lower lip and the line between the lips. Most other details were already in the drawing.

A version of the portrait with planted hatching on the left cheek had that patch blended. An erased pupil was not restored, because the reference's pupil lands about a unit from the drawn eye and V3 won't paint over the drawn lid. Accuracy at this scale depends on the line-up. All 11 test files pass.

**Edit a single area instead** (under More options) returns to the earlier per-feature AI-edit workflow below.

## Earlier: isolated feature edits and output checks

Replace `server.js` and the entire `public` folder, including the new `edit-validation.js`. Keep your existing `.env`. Restart the server, refresh the page, upload the images again and run Analyze drawing before generating another edit. Older generated proposals and cached outlines do not acquire the new masks automatically.

Left and right ears, eyes and brows are now separate edit choices. Their masks use each closed silhouette and its confidently matched drawing position; they do not expose the rectangle across the middle of the face. The same scope is enforced when compositing the returned image. Incomplete or implausibly broad outlines stop generation instead of falling back to a rectangle. Boundaries still depend on model estimates and are not anatomically verified.

The image request now includes the actual correction title, such as “Move the right ear right,” and explicitly requests opaque paper. Before accepting the result, the app checks for unexpected dimensions, transparency and substantial new solid black rectangles. Rejected output leaves the original and any previous proposal/strokes intact. Rectangle detection is a heuristic, not a guarantee that all artifacts or incorrect corrections will be detected. The screenshot alone does not establish where the original black fill came from.

Automatic uploaded-brow demonstrations are paused because the generic tone planner does not establish hair direction. The app explains this beside the drawing; Original, AI proposal and Reference remain available. The prepared eye and nose demonstrations are retained.

All eight automated test files pass, including production-handler checks with mocked image/API/DOM surfaces for rejection without state loss, valid acceptance, request masks, correction text and the brow playback guard. Live image generation and interactive browser rendering have not been verified in this environment. The sections below retain the project's earlier update history.

## Run it

Requires Node 18 or newer. There are no npm dependencies.

```bash
cp .env.example .env      # then put an OpenAI or Anthropic API key in .env
npm start                 # → http://localhost:3000
```

Sketchling works with either provider and uses whichever key is set:
- OpenAI keys come from https://platform.openai.com/api-keys
- Anthropic keys come from https://console.anthropic.com/settings/keys

If both keys are set, Anthropic is used unless you set `AI_PROVIDER=openai`. The startup line in the terminal shows which provider and model are active.

The sample "sitting cat" lesson and the practice pad work without a key. New lessons and critiques need one.

## How it fits together

```
public/index.html       the app (same page as the claude.ai artifact)
public/local-claude.js  stand-in for the artifact runtime: window.claude.use("sample")
server.js               static server + /api/claude proxy to OpenAI or Anthropic
```

The page talks to Claude only through `claude.use("sample")`. In claude.ai that call is provided by the artifact runtime. Locally, `local-claude.js` provides the same call by posting to `/api/claude`. The key stays on the server and never reaches the browser.

- **Lessons**: `sample.json(prompt)` returns steps whose strokes are SVG shapes on a 100×100 grid.
- **Critiques**: `sample.json(prompt, { images })` sends your drawing and an optional reference. Images are downscaled to a 1568px max side before upload.

## Settings (`.env`)

| Variable | Default | |
|---|---|---|
| `OPENAI_API_KEY` | — | set this or `ANTHROPIC_API_KEY` |
| `ANTHROPIC_API_KEY` | — | set this or `OPENAI_API_KEY` |
| `AI_PROVIDER` | auto | `openai` or `anthropic`; only needed if both keys are set |
| `OPENAI_MODEL` | `gpt-6.1-sol` | any OpenAI model that accepts images |
| `CLAUDE_MODEL` | `claude-sonnet-5-5` | any Messages API model id |
| `PORT` | `3000` | |
| `MAX_TOKENS` | `4096` | raise if long lessons come back cut off |

The server logs token usage for each request so you can watch the cost.

## Instruction cards
Each selected feature now has Look for, Try on paper, and Compare cards. These authored technique prompts vary by feature and by darken/lift action; they are not AI diagnoses. Uncertain shape matches are labeled Compare, with explicit guidance to preserve the drawing unless a difference is visible. Existing comparison and demonstration behavior is retained. This update does not fix photo-edge selection or certify overlay accuracy.

## Guided workspace
Drawing on the left; edit selection and numbered instruction cards on the right (stacked on small screens). Select an edit, then Show comparison area, Show this action, or Compare reference. Tone actions animate on the drawing. Shape steps show a labeled comparison box and, only when available, displacement arrows; they do not claim to demonstrate a verified redraw. Dense red photo-edge previews are removed from this guided flow. No automatic step advance.

## Jaw pencil demonstration
Select the jaw edit, then Show this action. Click intended start A, end B, and a point on the curve between them. The app marks A and B, then animates eight short light graphite strokes. Replay with Show this action; reset with Choose another segment. Other steps or view changes cancel point selection. The contour is user-selected, not an automatically verified correction. Your original image is unchanged.

## Prepared eye lesson in Sketchling
Run npm start and click Try prepared eye lesson above the workspace. No API key or uploads required. This loads the embedded portrait example and uses the existing SVG animation, original/preview controls and right-side step cards. Replay each step: endpoint marks, three short strokes, light second pass. It is a manual illustrative reconstruction, not an expert-reviewed correction or automatic teacher model. The original photo stays unchanged.


## Nose demonstration
Click **Try nose edit lesson** to play three target-driven eraser and pencil actions beside the instruction cards. No API key is required for this prepared example. Original, Preview and Reference compare the same crop. Brush masks reveal local pixels from an accepted generated target; this is not physical pencil simulation or automatic target generation for arbitrary uploads. Both generated crops differ from the exact uploaded pixels.


## Corrections on uploaded drawings
Upload your drawing and reference, click Show me, and line up the reference. Select an edit and click **Draw this correction**. An image-edit request creates a proposed target using the actual drawing, aligned reference and selected-area mask. Compare Original / Preview / Reference, then play the three eraser, pencil and shading layers on the uploaded sheet. Download proposed drawing exports the composite PNG.

Set OPENAI_API_KEY in .env for image editing (image generation is separately billed by your API provider). Analysis may still use Anthropic. OPENAI_IMAGE_MODEL defaults to gpt-image-1.5. The image-edit integration follows https://developers.openai.com/api/reference/resources/images/methods/edit . Generated geometry is not independently verified. Browser compositing preserves normalized original pixels outside the selected box, feathering its boundary. Playback is a difference-mask reveal, not a physical pencil simulation; paths are derived from raster changes, not an expert teacher recording. Generated results must be reviewed before copying on paper.


## Compact workspace UI
Main toolbar: Analyze drawing → Create edit → Play edits. Original / Edited / Reference switches the canvas view; Edited shows the complete proposed correction. The redundant See proposed edit button is removed from the visible UI. Choose a feature from Working on, then use Erase / Draw / Shade to replay one action and read its current instruction. More options contains download, attempt checking, prepared examples and generation context. Desktop canvas size is constrained by viewport height; narrow screens stack the workspace with a sticky action toolbar. This update changes presentation only; correction generation and pixel compositing remain the same.


## Shadow boundary guidance
Uploaded edit playback now outlines areas to erase on the original sheet (dashed rust), traces the proposed shadow shape (solid green), and compares the complete result. It no longer simulates erasing and repainting during these steps. Boundaries are derived from a 3×3 luminance average, a target-paper-relative shadow threshold, and connected shadow regions containing proposed darkening. Pixel-cell contour tracing preserves concavities and holes; only exactly collinear vertices are removed. Isolated regions smaller than 24 normalized pixels are filtered. Contours accurately follow these computed masks, but their artistic accuracy depends on the generated target and threshold; they are not expert-verified. Regions touching the selected edit box are clipped to that box.


## Eraser-only demonstration update
Before Create edit, numbered drawing steps are hidden and the panel explains that only an image comparison exists. Edited and Replay are disabled until a correction is available; Original and Reference remain available. For uploaded edits, step 1 now shows a small eraser rubbing short paths back and forth, locally blending toward lighter target pixels only inside the computed erase mask. There is no full-image lightening or end-of-step replacement, and darker replacement pixels are not added. Step 2 remains the target shadow contour; step 3 remains the complete proposed-result comparison. Playback uses normalized-image masks and is a visual simulation, not physical eraser modeling.


## Overall lightening shapes
Step 1 now traces a single continuous outline around a substantial lightening region, with a thin ivory halo and faint interior tint. It preserves large interior islands, focuses the view on the active region, and offers previous/next area controls when several distinct regions exist. Original and Reference retain the same focus for inspection. Dot-by-dot eraser playback is replaced.

The new extraction smooths luminance differences at a scale proportional to the feature, uses an adaptive threshold, closes small cracks, rejects texture specks, and ranks connected regions by their total lightening signal. It never wraps separated components in a convex hull. Paths are simplified within 1.2 pixels of the computed boundary on the normalized 1000-pixel image; smoothing and threshold selection still influence the shape. Contours touching the edit crop are withheld rather than presented as complete shapes. Numerically generated contours bypass the length cap for model-provided SVG strings.

Run npm test for the pixel and contour checks. The noisy synthetic-region test measures 0.960 intersection-over-union with its known shape and checks hole preservation, separate regions, unchanged images, and darkening-only inputs. This measures controlled mask extraction, not expert-verified artistic accuracy. An overlay on the prepared portrait was inspected; interactive browser playback could not be verified because a usable browser binary was unavailable.


## Shared visual teaching tools
Uploaded edits now use the same sequence for lightening and darkening: reveal a coherent region, animate a tool inside it, and pause after one light pass. Lighten uses a slim precision eraser with visible approach, compression and lift; pixels update only during contact. Darken uses a tip-anchored pencil, short strokes and lifts between strokes. A faint boundary remains visible. There are no floating text tool labels. The prepared examples share the same tool icons. The natural stroke update below supersedes the earlier fixed-point dab motion.

Region navigation works for both tools. Completed passes accumulate within the selected correction; replay reconstructs previous passes and repeats only the selected one. The full Edited view and download remain the generated proposed target, which may require more than one demonstrated pass. Plans are derived from each upload, not reused portrait coordinates. Clipped or unclear regions are not demonstrated. Generation quality still needs human visual judgment. All four test files pass, including guide confinement, correct lighten/darken direction, protected islands, and bounded action counts. Browser playback has not been verified in this environment.


## Natural correction strokes (current)
Lightening now uses short, continuous eraser passes with eased approach, tapered pressure, and an airborne lift between strokes. Fixed-point grid dabs are removed from uploaded corrections. The prepared eye remains a pencil lesson, with visible approach and lift between its authored strokes.

Uploaded passes follow local directions estimated from the excess-tone mask, use a narrower brush and lighter blending, and work within one nearby patch before pausing. They preserve protected islands and pixels needing the opposite change. The region boundary fades during playback to keep the correction visible. This is raster-based visual guidance; it does not add expert anatomical judgment or fix an incorrect generated target. A short demonstration intentionally shows only part of a large correction area; Edited still displays the full proposal.

All five test files pass, including sloping-line path alignment, continuous contact, pressure taper, mask confinement, cancellation, reduced motion, and identical playback/reconstruction at different simulated frame rates. A rendered prepared-nose pass was inspected. Interactive browser playback remains unverified in this environment.


## Actual edited result (current)
For uploaded corrections, the toolbar now separates four views: Original, Your edits, AI proposal, and Reference. Your edits and step 3 (Result) display the exact accumulated demonstration pixels. They never substitute the full generated target or reference photo. The guides disappear after a pass, and view switches preserve the same zoom. An on-canvas label identifies the image being shown. Your edits can still differ substantially from the AI proposal: the demonstration applies one local, light pass per selected area, not every generated change.

Applied stroke samples are retained even when playback is interrupted. Reconstruction uses those exact samples and their original pressure envelopes. Replay replaces the selected pass while preserving other applied passes. Download your edits exports the actual accumulated result; Download AI proposal exports the full generated suggestion separately. Generating/regenerating opens the explicitly labeled AI proposal, with no demonstration strokes applied yet.

Jaw/chin corrections with traced contours now use an open band along those contours (and confidently matched drawing segments), rather than exposing the entire face inside a jaw-sized rectangle. The band is supplied as the image-edit mask and enforced again during local compositing, including a soft boundary. Interior nose and mouth pixels outside the band are preserved regardless of generated output. This remains dependent on the estimated contour and is not a guarantee of anatomical accuracy. Reanalyze and regenerate a jaw correction to use the new mask; existing proposals are not retroactively changed.

All six automated test files pass. Additional checks cover distinct result/proposal/reference views, stable zoom, interrupted stroke reconstruction, and preserving pixels outside an open jaw band. Browser rendering and the live image-model result have not been verified here.
