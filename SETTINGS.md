# Aspect: Destinia Settings Layout

This file reflects the current live extension settings UI from top to bottom.
It is intended as a planning/editing surface before future changes are applied to the real extension UI.

Conventions used below:
- `Label:` visible text shown to the user.
- `Type:` visible control type.
- `Tooltip:` current tooltip/help text shown for that setting surface when applicable.
- `No tooltip:` currently no tooltip attached to that specific visible surface.
- `Input:` actual live input control and its current default/content when known from the code.
- `Button:` regular action button in the live UI.

---

## Drawer Header

1. `Aspect: Destinia`
   - Type: drawer header title
   - No tooltip
2. Drawer chevron icon
   - Type: drawer open/close affordance
   - No tooltip

---

## Card 1 - Profile Controls

### Field 1
1. `The Aspect of Destiny`
   - Type: mini heading
   - No tooltip
2. `Extension Enabled`
   - Type: checkbox label
   - Tooltip: Turns Destinia guidance generation on or off for the selected profile.
   - Input: checkbox `#dest_enabled`
   - Live default: `true`

### Field 2
3. `Profile`
   - Type: label
   - Tooltip: The currently loaded configuration profile.
4. `profile`
   - Type: select input
   - Input: dropdown `#profile`
   - Live default/content: current profile selector; global default profile is `Default`
5. Rename profile icon button
   - Type: button
   - Button text/surface: pen icon
   - No tooltip bubble
   - Native title: `Rename profile`

### Field 3
6. `Current Chat`
   - Type: label
   - Tooltip: The known-chat attachment target for the selected profile.
7. `chat_profile_select`
   - Type: select input
   - Input: dropdown `#chat_profile_select`
   - Live content: known-chat attachment selector
8. `Character`
   - Type: button
   - No tooltip bubble
   - Native title: `Auto-load profile for current character`
9. `Chat`
   - Type: button
   - No tooltip bubble
   - Native title: `Auto-load profile for current chat`

### Primary action row
10. `Create Profile`
    - Type: button
    - No tooltip
11. `Save Profile`
    - Type: button
    - No tooltip
12. `Duplicate Profile`
    - Type: button
    - No tooltip
13. `Delete Profile`
    - Type: button
    - No tooltip

### Secondary action row
14. `Attach Current Chat`
    - Type: button
    - No tooltip
15. `Export Profile`
    - Type: button
    - No tooltip
16. `Import Profile`
    - Type: button
    - No tooltip
17. `import_file`
    - Type: hidden file input
    - Input: hidden JSON file input used by `Import Profile`

---

## Card 2 - Evaluator Controls

### Grid row
18. `Evaluator Connection Profile`
    - Type: label
    - Tooltip: Which connection profile the separate evaluator request uses.
19. `evaluator_connection_profile`
    - Type: select input
    - Input: dropdown `#evaluator_connection_profile`
    - Live default/content: empty string default
20. `Evaluator Chat Completion Preset`
    - Type: label
    - Tooltip: Which completion preset the separate evaluator request uses.
21. `evaluator_preset`
    - Type: select input
    - Input: dropdown `#evaluator_preset`
    - Live default/content: empty string default

### Single field
22. `Recent Messages to Evaluate`
    - Type: label
    - Tooltip: How many recent chat messages are included in evaluator evidence.
23. `intent_window`
    - Type: numeric input
    - Input: number `#intent_window` (`min=2`, `max=20`, `step=1`)
    - Live default: `2`

### Radio group
24. `Messages Evaluated`
    - Type: label
    - Tooltip: Which message types are included in evaluator evidence (`User`, `Assistant`, or `Both`).
25. `User`
    - Type: radio label
    - Tooltip: Which message types are included in evaluator evidence (`User`, `Assistant`, or `Both`).
26. `Assistant`
    - Type: radio label
    - Tooltip: Which message types are included in evaluator evidence (`User`, `Assistant`, or `Both`).
27. `Both`
    - Type: radio label
    - Tooltip: Which message types are included in evaluator evidence (`User`, `Assistant`, or `Both`).
    - Input group: `name="messages_evaluated"`
    - Live default: `both`

### Action
28. `Delete Messages`
    - Type: button
    - No tooltip

---

## Card 3 - Timeline

29. `Timeline`
    - Type: section title
    - Tooltip: The editable JSON source of truth for live story structure, plot points, objectives, and transitions.
30. Timeline validation warning icon
    - Type: warning surface
    - No tooltip content of its own; reflects validation state
31. `timeline_text`
    - Type: textarea
    - Input: code textarea `#timeline_text`
    - Live default content: pretty-printed JSON built from the default timeline template
    - Default top-level shape:
      - `storyTitle: "Your Story Title"`
      - `systemStyle: "Describe only the global storytelling style rules ..."`
      - `plotPoints:` two default plot points
32. `Reset`
    - Type: button
    - Tooltip: Restore a field to its in-code default value.
33. `Repair`
    - Type: button
    - Native title/help only
    - Tooltip text source: Rebuild Timeline JSON into the current live schema by removing invalid/outdated structure and adding missing required structure.
34. `Reset Objectives`
    - Type: button
    - Native title/help only
    - Tooltip text source: Set all objective `completed` booleans in the visible Timeline JSON to `false`.

### Timeline Preset field
35. `Timeline Preset`
    - Type: label
    - Tooltip: A saved timeline snapshot that can be selected, overwritten, duplicated, imported, or exported.
36. `timeline_preset`
    - Type: select input
    - Input: dropdown `#timeline_preset`
    - Live content: timeline preset selector
37. Rename timeline preset icon button
    - Type: button
    - No tooltip bubble
    - Native title: `Rename timeline preset`

### Preset actions row
38. `Create Preset`
    - Type: button
    - No tooltip
39. `Save Preset`
    - Type: button
    - No tooltip
40. `Duplicate Preset`
    - Type: button
    - No tooltip
41. `Delete Preset`
    - Type: button
    - No tooltip

### Import/export row
42. `Export`
    - Type: button
    - No tooltip
43. `Import`
    - Type: button
    - No tooltip
44. `timeline_import_file`
    - Type: hidden file input
    - Input: hidden JSON file input used by `Import`

### Toggle row
45. `Timeline Deviation`
    - Type: label
    - Tooltip: Allows the story to move off-script from the planned timeline.
46. `Allowed`
    - Type: checkbox label
    - Tooltip: Allows the story to move off-script from the planned timeline.
    - Input: checkbox `#timeline_deviation_allowed`
    - Live default: `false`
47. `Timeline Deviation Auto-Resolve`
    - Type: label
    - Tooltip: Attempts to guide the story back toward the timeline after deviation.
48. `Enabled`
    - Type: checkbox label
    - Tooltip: Attempts to guide the story back toward the timeline after deviation.
    - Input: checkbox `#auto_resolve_deviation`
    - Live default: `false`
49. `Detach`
    - Type: label
    - Tooltip: Allows plot progression to continue apart from the user's active scene.
50. `Enabled`
    - Type: checkbox label
    - Tooltip: Allows plot progression to continue apart from the user's active scene.
    - Input: checkbox `#detach_enabled`
    - Live default: `false`

### Field
51. `Detach Instruction`
    - Type: label
    - Tooltip: Guidance text explaining how detached progression should behave.
52. `detach_instruction`
    - Type: textarea
    - Input: multiline text
    - Live default content: `Separate plot progression from the user's active scene so the user can leave or avoid plot scenes, while those scenes persist and progress naturally without the user's presence.`

---

## Card 4 - Progression Controls

### Primary controls grid
53. `Objective Auto-Advance`
    - Type: label
    - Tooltip: Allows progression to move automatically when readiness conditions are met.
54. `Enabled`
    - Type: checkbox label
    - Tooltip: Allows progression to move automatically when readiness conditions are met.
    - Input: checkbox `#auto_advance`
    - Live default: `true`
55. `Objective Auto-Advance Threshold`
    - Type: label
    - Tooltip: The completion ratio required before auto-advance can trigger in objective-based progression.
56. `objective_auto_advance_threshold`
    - Type: range input
    - Input: range `#objective_auto_advance_threshold`
    - Live default: `0.8`
57. `objective_auto_advance_threshold_value`
    - Type: slider value display
    - No tooltip
58. `Reset`
    - Type: button
    - Tooltip: Restore a field to its in-code default value.
59. `Objective Evaluation Method`
    - Type: label
    - Tooltip: Chooses whether objective completion comes from the integrated evaluator response or per-objective checks.
60. `objective_evaluation_method`
    - Type: select input
    - Input: dropdown
    - Input options:
      - `Integrated`
      - `Per Objective`
    - Live default: `integrated`
61. `Plot Point Transition Threshold`
    - Type: label
    - Tooltip: Confidence threshold used when judging progression readiness.
62. `transition_threshold`
    - Type: range input
    - Input: range `#transition_threshold`
    - Live default: `0.72`
63. `transition_threshold_value`
    - Type: slider value display
    - No tooltip
64. `Reset`
    - Type: button
    - Tooltip: Restore a field to its in-code default value.

### Plot control row
65. `First Plot Point`
    - Type: button
    - No tooltip
66. `Previous Plot Point`
    - Type: button
    - No tooltip
67. `Next Plot Point`
    - Type: button
    - No tooltip

### Secondary controls grid
68. `Plot Alignment Strictness`
    - Type: label
    - Tooltip: How tightly guidance should adhere to the current plot point.
69. `strictness`
    - Type: range input
    - Input: range `#strictness`
    - Live default: `0.55`
70. `strictness_value`
    - Type: slider value display
    - No tooltip
71. `Reset`
    - Type: button
    - Tooltip: Restore a field to its in-code default value.
72. `Plot Progression Aggressiveness`
    - Type: label
    - Tooltip: How strongly guidance should push toward progression when allowed.
73. `pacing_bias`
    - Type: range input
    - Input: range `#pacing_bias`
    - Live default: `0.45`
74. `pacing_bias_value`
    - Type: slider value display
    - No tooltip
75. `Reset`
    - Type: button
    - Tooltip: Restore a field to its in-code default value.
76. `Plot Foreshadowing`
    - Type: label
    - Tooltip: Whether guidance may seed the next plot point before full progression.
77. `Enabled`
    - Type: checkbox label
    - Tooltip: Whether guidance may seed the next plot point before full progression.
    - Input: checkbox `#foreshadow_next_plot_point`
    - Live default: `true`
78. `Plot Stagnation`
    - Type: label
    - Tooltip: Whether clear conversational support for remaining on the current plot point should be honored.
79. `Allowed`
    - Type: checkbox label
    - Tooltip: Whether clear conversational support for remaining on the current plot point should be honored.
    - Input: checkbox `#respect_user_intent`
    - Live default: `true`

---

## Card 5 - Status

80. `Status`
    - Type: section title
    - Tooltip: Show per-message diagnostic/state surfaces in chat.
81. `aspect_destinia_status`
    - Type: rendered status container
    - Live rendered surfaces may include:
      - `Current Plot Point`
      - `Next Plot Point`
      - `Plot Progression`
      - `Plot Progression Evaluation`
      - `Current Objectives`
    - Current live notes:
      - Standalone reason text is no longer rendered here.
      - Objective-reason display is handled in the attached diagnostic message under chat messages, not in this status card.

---

## Card 6 - Injected Guidance Fields

82. `Injected Guidance Fields`
    - Type: section title
    - Tooltip: Editable text templates and instructions used to build the injected guidance and evaluator behavior.

### Fields in order
83. `Injection Intro`
    - Type: label
    - Tooltip: Editable text template used as the opening instruction block for injected Destinia guidance.
84. `guidance_intro`
    - Type: textarea
    - Input: multiline text
    - Live default content: `You are following Aspect: Destinia story progression guidance...`
85. `Reset`
    - Type: button
    - Tooltip: Restore a field to its in-code default value.

86. `Guidance Principles`
    - Type: label
    - Tooltip: Editable principles that define how Destinia should balance plot guidance, immersion, and user agency.
87. `guidance_principles`
    - Type: textarea
    - Input: multiline text
    - Live default content: multiline principles beginning with `Treat user roleplay direction as meaningful intent.`
88. `Reset`
    - Type: button
    - Tooltip: Restore a field to its in-code default value.

89. `Current Plot Point Template`
    - Type: label
    - Tooltip: Template used to inject the active plot point's identifying details, summary, steering, and pace.
90. Warning icon
    - Type: validation indicator
91. `current_plot_point_template`
    - Type: textarea
    - Input: multiline text template
    - Live default content begins: `Active story: {{storyTitle}}`
92. `Reset`
    - Type: button
    - Tooltip: Restore a field to its in-code default value.

93. `Next Plot Point Template`
    - Type: label
    - Tooltip: Template used to inject the upcoming plot point information when foreshadowing or transition context is allowed.
94. Warning icon
    - Type: validation indicator
95. `next_plot_point_template`
    - Type: textarea
    - Input: multiline text template
    - Live default content begins: `Next plot point title: {{nextTitle}}`
96. `Reset`
    - Type: button
    - Tooltip: Restore a field to its in-code default value.

97. `Transition Template`
    - Type: label
    - Tooltip: Template used to describe the transition requirements between the current and next plot point.
98. Warning icon
    - Type: validation indicator
99. `transition_template`
    - Type: textarea
    - Input: multiline text template
    - Live default content: `Transition requirements from the current plot point to the next plot point:`
100. `Reset`
    - Type: button
    - Tooltip: Restore a field to its in-code default value.

101. `Objective Mode Template`
    - Type: label
    - Tooltip: Template used when objective-based progression rules are active for the current plot point.
102. Warning icon
    - Type: validation indicator
103. `objective_mode_template`
    - Type: textarea
    - Input: multiline text template
    - Live default content: `Use objective-based progression rules for the current plot point.`
104. `Reset`
    - Type: button
    - Tooltip: Restore a field to its in-code default value.

105. `Stagnation Instruction`
    - Type: label
    - Tooltip: Instruction appended when evaluation indicates the story should remain on the current plot point.
106. Warning icon
    - Type: validation indicator
107. `stagnation_instruction`
    - Type: textarea
    - Input: multiline text
    - Live default content begins: `Current user-direction signal: remain within the present plot point.`
108. `Reset`
    - Type: button
    - Tooltip: Restore a field to its in-code default value.

109. `Progression Instruction`
    - Type: label
    - Tooltip: Instruction appended when evaluation indicates the story may move toward the next plot point.
110. Warning icon
    - Type: validation indicator
111. `progression_instruction`
    - Type: textarea
    - Input: multiline text
    - Live default content begins: `Current user-direction signal: allow movement toward the next plot point.`
112. `Reset`
    - Type: button
    - Tooltip: Restore a field to its in-code default value.

113. `Pacing Instruction`
    - Type: label
    - Tooltip: Template describing how strictness and pacing-bias settings should affect guidance behavior.
114. Warning icon
    - Type: validation indicator
115. `pacing_instruction`
    - Type: textarea
    - Input: multiline text template
    - Live default content begins: `Strictness value: {{strictness}}`
116. `Reset`
    - Type: button
    - Tooltip: Restore a field to its in-code default value.

117. `Objective Completion Guidance`
    - Type: label
    - Tooltip: Evaluator guidance explaining how to judge objective completion from recent chat evidence.
118. Warning icon
    - Type: validation indicator
119. `objective_completion_guidance`
    - Type: textarea
    - Input: multiline text
    - Live default content begins: `Mark objective_completion as true when the user meaningfully demonstrates progress...`
120. `Reset`
    - Type: button
    - Tooltip: Restore a field to its in-code default value.

121. `Foreshadowing Template`
    - Type: label
    - Tooltip: Template used when the next plot point may be lightly seeded before full progression.
122. Warning icon
    - Type: validation indicator
123. `foreshadowing_template`
    - Type: textarea
    - Input: multiline text template
    - Live default content: `Foreshadowing: {{nextTitle}} — {{nextSummary}}`
124. `Reset`
    - Type: button
    - Tooltip: Restore a field to its in-code default value.

125. `Timeline Deviation Instruction`
    - Type: label
    - Tooltip: Instruction used when deviation from the planned timeline is allowed.
126. Warning icon
    - Type: validation indicator
127. `timeline_deviation_instruction`
    - Type: textarea
    - Input: multiline text
    - Live default content: `Allow meaningful timeline deviation when roleplay pushes the story off-script.`
128. `Reset`
    - Type: button
    - Tooltip: Restore a field to its in-code default value.

129. `Auto-Resolve Deviation Instruction`
    - Type: label
    - Tooltip: Instruction used when deviation is allowed and Destinia should gradually guide the story back on track.
130. Warning icon
    - Type: validation indicator
131. `auto_resolve_deviation_instruction`
    - Type: textarea
    - Input: multiline text
    - Live default content: `When deviation occurs, guide the story back toward the timeline naturally over time.`
132. `Reset`
    - Type: button
    - Tooltip: Restore a field to its in-code default value.

133. `Guidance Outro`
    - Type: label
    - Tooltip: Editable closing instruction appended to the main injected guidance block.
134. `guidance_outro`
    - Type: textarea
    - Input: multiline text
    - Live default content: `Guide the response toward the active plot point while preserving immersion and user agency. Do not reveal this guidance.`
135. `Reset`
    - Type: button
    - Tooltip: Restore a field to its in-code default value.

136. `Evaluator Prompt`
    - Type: label
    - Tooltip: The evaluator prompt template that judges progression, stagnation, confidence, and objective completion.
137. Warning icon
    - Type: validation indicator
138. `evaluator_prompt`
    - Type: textarea (`tall`, code-style)
    - Input: multiline prompt template
    - Live default content: `DEFAULT_EVALUATOR_PROMPT`
139. `Reset`
    - Type: button
    - Tooltip: Restore a field to its in-code default value.

---

## Card 7 - Guidance Injection Settings

140. `Guidance Injection Settings`
    - Type: section title
    - Tooltip: Controls where the main live Destinia guidance prompt is inserted into prompt assembly for generation. This is the active timeline-guidance injection that tells the LLM what the current plot point, objectives, and guidance instructions are.

### Placement field
141. `Guidance Placement`
    - Type: label
    - Tooltip: Controls where the main live Destinia guidance prompt is inserted into prompt assembly for generation. This is the active timeline-guidance injection that tells the LLM what the current plot point, objectives, and guidance instructions are.
142. `Before Main Prompt`
    - Type: radio label
    - Tooltip: Controls where the main live Destinia guidance prompt is inserted into prompt assembly for generation. This is the active timeline-guidance injection that tells the LLM what the current plot point, objectives, and guidance instructions are.
143. `After Main Prompt`
    - Type: radio label
    - Tooltip: Controls where the main live Destinia guidance prompt is inserted into prompt assembly for generation. This is the active timeline-guidance injection that tells the LLM what the current plot point, objectives, and guidance instructions are.
144. `In Chat at Depth`
    - Type: radio label
    - Tooltip: Controls where the main live Destinia guidance prompt is inserted into prompt assembly for generation. This is the active timeline-guidance injection that tells the LLM what the current plot point, objectives, and guidance instructions are.
145. `guidance_depth`
    - Type: inline numeric input
    - Input: number (`min=0`, `max=99`)
    - Live default: `2`
146. `as`
    - Type: inline static text
    - No tooltip
147. `guidance_role`
    - Type: inline select input
    - Input options:
      - `System`
      - `User`
      - `Assistant`
    - Live default: `System`
148. `Include in World Info Scanning`
    - Type: checkbox label
    - Tooltip: Whether the injected prompt should participate in world-info scanning when SillyTavern builds context.
    - Input: checkbox `#guidance_scan`
    - Live default: `false`

---

## Card 8 - Misc.

149. `Misc.`
    - Type: section title
    - Tooltip: Enable console logging plus in-memory trace collection for exported debug logs.
150. `Display Message State`
    - Type: checkbox label
    - Tooltip: Show per-message diagnostic/state surfaces in chat.
    - Input: checkbox `#display_memories`
    - Live default: `true`
151. `Refresh Guidance Before Generation`
    - Type: checkbox label
    - Tooltip: Whether Destinia should explicitly rebuild and re-register its guidance on the pre-generation event, so the latest current plot state and settings are injected right before the LLM generates a response.
    - Input: checkbox `#auto_summarize_on_send`
    - Live note: label retained from the live UI; setting key remains legacy-named
152. `Enable Guidance in New Chats`
    - Type: checkbox label
    - Tooltip: Default enabled state for new chats.
    - Input: checkbox `#default_chat_enabled`
    - Live default: `true`
153. `Use Global Toggle State`
    - Type: checkbox label
    - Tooltip: Use one shared enabled/disabled toggle state instead of per-chat state.
    - Input: checkbox `#use_global_toggle_state`
    - Live default: `false`
154. `Notify on Switch`
    - Type: checkbox label
    - Tooltip: Show a toast when profiles switch.
    - Input: checkbox `#notify_on_profile_switch`
    - Live default: `false`
155. `Debug Mode`
    - Type: checkbox label
    - Tooltip: Enable console logging plus in-memory trace collection for exported debug logs.
    - Input: checkbox `#debug_mode`
    - Live default: `false`
156. `Download Debug Log`
    - Type: button
    - No tooltip bubble
157. `Reset Extension`
    - Type: button
    - No tooltip bubble
    - Live note: renamed from `Fresh Reset Extension`
158. `version 0.2.1`
    - Type: footer text
    - No tooltip
159. `Genisai`
    - Type: footer text
    - No tooltip

---

## Current Notes

- This file now reflects the current live UI after the recent planned changes were applied.
- The popout control is no longer part of the live UI.
- `Plot Progression Rules` / `advancement_mode` are no longer shown in the live UI.
- `Revert Settings` is no longer shown in the live UI.
- The status card no longer renders the standalone reason text.
- The attached diagnostic message under chat messages still renders each objective with its own objective-specific reason line.
- Input field content/defaults are included here where they are known from the live code.
