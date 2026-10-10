## Inspiration

I used to take art classes and wanted to keep learning how to draw. But when I worked on sketches by myself, I often got stuck. I could tell that something looked wrong, but I didn't know what to fix first.

I wanted something that could show me what to do, like an art teacher drawing a few corrections on my sketch. That's where the idea for Sketchling came from.

## What it does

You upload your drawing and the reference you're using, then line them up. Sketchling compares them and shows suggested changes on a copy of your drawing in three stages:

- **V1: Shape and proportion** — adjust where features are and how big they should be.
- **V2: Light and shadow** — show where to add shading or erase.
- **V3: Details and finishing** — blend rough marks, refine edges, and add small shadows and highlights.

The list on the right follows the demonstration and checks off each step. You can pause to try it on paper and switch between the original, each stage, and the reference.

## How I built it

I used HTML, CSS, and JavaScript for the website, and Node.js to connect it to AI APIs. I also used AI coding tools to help write and debug the code.

The first version only gave written instructions. That wasn't really what I wanted. If it told me to “check the jaw,” I still needed someone to show me how.

Turning those instructions into something visual was much harder than I expected. At first, I mostly got angular lines, misplaced strokes, and marks that were hard to understand.

After a few tries, I realized the drawing and reference needed to be close enough in size and alignment before the app could compare them properly. I added a step to line them up. That helped with finding the right positions, but the step-by-step teaching still wasn't very good.

I then tried smaller demonstrations for just an eye or a nose. Showing where to erase and darken was more helpful, so I worked on applying that to the uploaded drawing. But having to select and run every edit separately became awkward.

That's when I thought about improving the drawing in layers. Instead of jumping between unrelated corrections, the app could work on the shapes first, then shading, then details. This became the three-stage tutorial.

## Challenges I ran into

The biggest challenge was getting from “here is something to fix” to actually showing how to fix it.

Arrows and colored areas weren't enough. Some eraser animations looked like little dots, and some pencil strokes didn't follow the shape of the drawing. One attempt to edit an ear even produced a black rectangle.

Another problem was the comparison view. Sometimes it showed a proposed finished image that didn't match the edits I had just watched. I needed the result and the demonstration to follow the same plan.

I also learned that differences in lighting or alignment could look like drawing mistakes. The app still isn't always right, so being able to pause and compare with the reference is important.

## Accomplishments I'm proud of

I'm proud that Sketchling now shows changes happening on the drawing instead of only giving written advice.

Getting the landmarks was easier than getting the edits to appear correctly. I used HTML Canvas to update the drawing's pixels and animated pencil, eraser, and blending tools over it. The checklist and visual changes use the same edit plan so they stay connected.

Seeing the three stages build on each other felt much closer to the art lesson I originally wanted.

## What I learned

I learned more about building a website, calling APIs, and using JavaScript scripts inside an HTML page and in separate files. I also learned how to work with image pixels and animations.

I expected turning an instruction into a demonstration to be fairly simple. It ended up being the hardest part. Testing the app kept showing me the difference between advice that sounds helpful and something I could actually follow while drawing.

## What's next for Sketchling

I'd like to add live camera tutoring, so the app can watch my progress and coach me while I draw. Before that, I want to improve the accuracy of the corrections and get feedback from art teachers about whether the demonstrations are actually useful.
