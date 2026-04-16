# 🚧 Not Yet Ready! Work in Progress. 🚧

# Aspect: Destinia

Aspect: Destinia is a SillyTavern extension for story progression. It lets you set up a timeline of plot points, keep each chat tied to its own place in that timeline, and guide the roleplay forward without having to manually steer the narrative.

The extension is meant for people who want better continuity over long roleplay sessions. It keeps track of plot points, what criteria needs to be met in order to progress in the story, and much more. The goal is to keep the story coherent and easier to manage over time.

## What It Does

- Binds a progression state to each chat
- Keeps different chats on separate progression tracks
- Lets you paste and edit timeline JSON directly in the extension settings
- Lets you create, save, duplicate, rename, import, export, and delete timeline presets from the UI
- Tracks plot points, objectives, pacing, and transition guidance
- Supports progression based on user intent, objective completion, or both
- Lets you tune how strictly the story stays aligned to the current plot point
- Supports optional deviation and return-to-track behavior
- Lets you choose a separate connection profile and preset for evaluation requests
- Exposes prompt placement, depth, role, and scan settings for guidance injection
- Stores state with the chat so progress carries across sessions
- Includes debug and diagnostic tools for testing and troubleshooting

## Important Design Notes

- It is meant to guide the narrative according to a supplied timeline
- It is built for long-running chats that need continuity between scenes
- Progress can be per chat or shared between multiple chats
- Profiles and presets let you reuse setups across different stories
- Guidance text and evaluation behavior can be edited from the UI
- The included timeline is only an empty template
- No copyrighted story material is bundled with the extension
- The extension is designed to work without slash commands

## Timeline Shape

### Template

```json
{
  "storyTitle": "Your Story Title",
  "systemStyle": "Describe the overall storytelling rules, tone, pacing, canon handling, and style for the full timeline.",
  "plotPoints": [
    {
      "id": "plot-point-1",
      "title": "Opening Situation",
      "summary": "Describe the current stage of the story.",
      "objectives": [
        {
          "text": "Establish the setting and immediate situation.",
          "completed": false
        },
        {
          "text": "Introduce the goals or tensions that matter in this phase.",
          "completed": false
        }
      ],
      "steeringPrompt": "Describe how the assistant should handle this phase of the story.",
      "transitionGuidance": "Show the causal bridge from this plot point into the next plot point before the next plot point action fully begins.",
      "pace": "medium",
      "delayable": true
    }
  ]
}
```

### Example

```json
{
  "storyTitle": "The Lantern Under Greyglass Pier",
  "systemStyle": "Keep the tone moody but adventurous. The setting should feel like a rain-soaked harbor town with old secrets beneath the surface. Let scenes develop through character action and conversation instead of sudden exposition. Preserve user agency and avoid forcing immediate progression before the current situation has been meaningfully explored.",
  "plotPoints": [
    {
      "id": "plot-point-1",
      "title": "The Strange Delivery",
      "summary": "The user arrives in Greyglass Harbor and is asked to deliver a sealed brass lantern to a retired lighthouse keeper before midnight. Rumors around the pier suggest the lantern is tied to an old disappearance.",
      "objectives": [
        {
          "text": "Introduce Greyglass Harbor and its uneasy atmosphere.",
          "completed": false
        },
        {
          "text": "Make the lantern and its delivery feel important.",
          "completed": false
        },
        {
          "text": "Give the user at least one meaningful chance to ask questions, investigate, or choose how to approach the task.",
          "completed": false
        }
      ],
      "steeringPrompt": "Keep the story centered on the delivery, the harbor, and the growing sense that something is wrong. Let the user explore, question townsfolk, or head straight for the lighthouse, but keep attention on the lantern and what it may mean.",
      "transitionGuidance": "Move into the next plot point only after the user has engaged with the harbor situation enough for the delivery to feel grounded, and once events begin drawing them toward the lighthouse or the truth behind the lantern.",
      "pace": "medium",
      "delayable": true
    },
    {
      "id": "plot-point-2",
      "title": "The Keeper's Warning",
      "summary": "At the lighthouse, the retired keeper reveals that the lantern was never meant to be lit again. If opened or activated, it may call something back from the fog beyond the breakwater.",
      "objectives": [
        {
          "text": "Reveal that the lantern has a dangerous history.",
          "completed": false
        },
        {
          "text": "Establish the lighthouse keeper as a source of truth, fear, or conflicting motives.",
          "completed": false
        },
        {
          "text": "Present the user with a choice about what to do with the lantern next.",
          "completed": false
        }
      ],
      "steeringPrompt": "Shift the story from mystery toward revelation. Keep tension high, but let the user decide whether to trust the keeper, inspect the lantern, or take another path.",
      "transitionGuidance": "Only move forward once the user has enough information to understand the lantern matters, and a clear next action has emerged from their choices.",
      "pace": "medium",
      "delayable": true
    }
  ]
}
```

Please consider tipping a job well done. 

<a href="https://ko-fi.com/genisai">
  <img src="https://github.com/Vectricity/st-aspect-destinia/raw/assets/assets/ko-fi_thumbnail_genisai.png" alt="Support Genisai on Ko-fi" width="400">
</a>
