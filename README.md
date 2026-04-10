# Aspect: Destinia

Aspect: Destinia is a SillyTavern user extension that softly guides roleplay along a story timeline without railroading the user. It interprets whether the user is trying to move the story forward or remain within the current plot point, then injects guidance accordingly.

## Install Location

Place this folder here:

`SillyTavern/data/default-user/extensions/st-aspect-destinia`

## What It Does

- Binds a progression entry to a chat
- Keeps separate progression for different chats
- Lets you paste timeline data directly in extension settings
- Lets you save, duplicate, and delete timeline presets from the UI
- Supports objective-based advancement rules
- Lets you edit injected guidance fields in the extension UI
- Uses a proven SillyTavern extension architecture as the foundation for stable prompt delivery and per-message persisted state
- Exposes prompt placement, depth, role, and scan controls so users can tune how Destinia guidance is injected into SillyTavern context
- Uses quiet background evaluation to interpret user intent:
  - stay on the current plot point
  - or allow transition toward the next one

## Important Design Notes

- No slash commands are required
- No copyrighted story content is included by default
- The default timeline is only a template
- The extension stores state on chat/message data using a Qvink-style persisted architecture
- The extension is currently being rebuilt on top of the Qvink foundation

## Timeline Shape

```json
{
  "storyTitle": "Your Story Title",
  "systemStyle": "Describe desired tone and canon handling.",
  "plotPoints": [
    {
      "id": "plot-point-1",
      "title": "Opening Situation",
      "summary": "Describe the phase.",
      "objectives": [
        "Goal one",
        "Goal two"
      ],
      "completionHints": [
        "Hint one",
        "Hint two"
      ],
      "steeringPrompt": "Specific steering guidance for this plot point.",
      "pace": "medium",
      "delayable": true
    }
  ]
}
```
