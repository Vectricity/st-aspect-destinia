# Aspect: Destinia

Aspect: Destinia is a SillyTavern user extension that softly guides roleplay along a story timeline without railroading the user. It interprets whether the user is trying to move the story forward or remain within the current plot point, then injects guidance accordingly.

## Install Location

Place this folder here:

`SillyTavern/data/default-user/extensions/st-aspect-destinia`

The folder should contain:

- `manifest.json`
- `index.js`
- `style.css`
- `README.md`

## What It Does

- Binds a progression entry to a chat
- Keeps separate progression for different chats
- Lets you paste timeline data directly in extension settings
- Lets you save, duplicate, and delete timeline presets from the UI
- Supports:
  - objective-based advancement rules
  - simple completion hints
- Lets you edit all injected guidance fields in the extension UI
- Uses a generation interceptor to inject guidance into normal generations
- Uses quiet background evaluation to interpret user intent:
  - stay on the current plot point
  - or allow transition toward the next one

## Important Design Notes

- No slash commands are required
- No copyrighted story content is included by default
- The default timeline is only a template
- The extension stores the current chat’s linked entry in chat metadata
- The extension keeps a known-chat registry for reassignment in the UI

## Timeline Shape

```json
{
  "storyTitle": "Your Story Title",
  "systemStyle": "Describe desired tone and canon handling.",
  "progressionNotes": "Optional global notes.",
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
Please consider supporting me on [Ko-fi](https://ko-fi.com/genisai)
