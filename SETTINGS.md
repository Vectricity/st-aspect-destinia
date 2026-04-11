# Aspect: Destinia Settings Layout

This file is a planning surface for the live extension settings UI.
It reflects the current live settings layout from top to bottom so future settings changes can be planned here first before changing the actual extension UI.

Conventions used below:
- `Label:` visible text shown to the user.
- `Type:` visible control type.
- `Tooltip:` current tooltip/help text shown for that setting surface when applicable.
- `No tooltip:` currently no tooltip attached to that specific visible surface.
- `Button:` regular action button in the live UI.
- `Input:` editable control in the live UI.

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

### Field 2
3. `Profile`
   - Type: label
   - Tooltip: The currently loaded configuration profile.
4. `profile`
   - Type: select input
   - Input: dropdown
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
   - Input: dropdown
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
18. Popout icon button
    - Type: button
    - No tooltip bubble
    - Native title: `Move config to floating popout`
    - Planning status: Marked for removal (not desired)

---

## Card 2 - Evaluator Controls

### Grid row
19. `Evaluator Connection Profile`
    - Type: label
    - Tooltip: Which connection profile the separate evaluator request uses.
20. `evaluator_connection_profile`
    - Type: select input
    - Input: dropdown
21. `Evaluator Chat Completion Preset`
    - Type: label
    - Tooltip: Which completion preset the separate evaluator request uses.
22. `evaluator_preset`
    - Type: select input
    - Input: dropdown

### Single field
23. `Recent Messages to Evaluate`
    - Type: label
    - Tooltip: How many recent chat messages are included in evaluator evidence.
24. `intent_window`
    - Type: numeric input
    - Input: number (`min=4`, `max=20`, `step=1`)
    - Planning change: Change default from `8` to `2`

### Radio group
25. `Messages Evaluated`
    - Type: label
    - Tooltip: Which message types are included in evaluator evidence (`User`, `Assistant`, or `Both`).
26. `User`
    - Type: radio label
    - Tooltip: Which message types are included in evaluator evidence (`User`, `Assistant`, or `Both`).
27. `Assistant`
    - Type: radio label
    - Tooltip: Which message types are included in evaluator evidence (`User`, `Assistant`, or `Both`).
28. `Both`
    - Type: radio label
    - Tooltip: Which message types are included in evaluator evidence (`User`, `Assistant`, or `Both`).

### Action
29. `Delete Messages`
    - Type: button
    - No tooltip

---

## Card 3 - Timeline

30. `Timeline`
    - Type: section title
    - Tooltip: The editable JSON source of truth for live story structure, plot points, objectives, and transitions.
31. Timeline validation warning icon
    - Type: warning surface
    - No tooltip content of its own; reflects validation state
32. `timeline_text`
    - Type: textarea
    - Input: code textarea
33. `Reset`
    - Type: button
    - Tooltip: Restore a field to its in-code default value.
34. `Repair`
    - Type: button
    - Native title/help only
    - Tooltip text source: Rebuild Timeline JSON into the current live schema by removing invalid/outdated structure and adding missing required structure.
35. `Reset Objectives`
    - Type: button
    - Native title/help only
    - Tooltip text source: Set all objective `completed` booleans in the visible Timeline JSON to `false`.

### Timeline Preset field
36. `Timeline Preset`
    - Type: label
    - Tooltip: A saved timeline snapshot that can be selected, overwritten, duplicated, imported, or exported.
37. `timeline_preset`
    - Type: select input
    - Input: dropdown
38. Rename timeline preset icon button
    - Type: button
    - No tooltip bubble
    - Native title: `Rename timeline preset`

### Preset actions row
39. `Create Preset`
    - Type: button
    - No tooltip
40. `Save Preset`
    - Type: button
    - No tooltip
41. `Duplicate Preset`
    - Type: button
    - No tooltip
42. `Delete Preset`
    - Type: button
    - No tooltip

### Import/export row
43. `Export`
    - Type: button
    - No tooltip
44. `Import`
    - Type: button
    - No tooltip
45. `timeline_import_file`
    - Type: hidden file input

### Toggle row
46. `Timeline Deviation`
    - Type: label
    - Tooltip: Allows the story to move off-script from the planned timeline.
47. `Allowed`
    - Type: checkbox label
    - Tooltip: Allows the story to move off-script from the planned timeline.
48. `Timeline Deviation Auto-Resolve`
    - Type: label
    - Tooltip: Attempts to guide the story back toward the timeline after deviation.
49. `Enabled`
    - Type: checkbox label
    - Tooltip: Attempts to guide the story back toward the timeline after deviation.
50. `Detach`
    - Type: label
    - Tooltip: Allows plot progression to continue apart from the user's active scene.
51. `Enabled`
    - Type: checkbox label
    - Tooltip: Allows plot progression to continue apart from the user's active scene.

### Field
52. `Detach Instruction`
    - Type: label
    - Tooltip: Guidance text explaining how detached progression should behave.
53. `detach_instruction`
    - Type: textarea
    - Input: multiline text

---

## Card 4 - Progression Controls

### Primary controls grid
54. `Objective Auto-Advance`
    - Type: label
    - Tooltip: Allows progression to move automatically when readiness conditions are met.
55. `Enabled`
    - Type: checkbox label
    - Tooltip: Allows progression to move automatically when readiness conditions are met.
56. `Objective Auto-Advance Threshold`
    - Type: label
    - Tooltip: The completion ratio required before auto-advance can trigger in objective-based progression.
57. `objective_auto_advance_threshold`
    - Type: range input
58. `objective_auto_advance_threshold_value`
    - Type: slider value display
    - No tooltip
59. `Reset`
    - Type: button
    - Tooltip: Restore a field to its in-code default value.
60. `Objective Evaluation Method`
    - Type: label
    - Tooltip: Chooses whether objective completion comes from the integrated evaluator response or per-objective checks.
61. `objective_evaluation_method`
    - Type: select input
    - Input options:
      - `Integrated`
      - `Per Objective`
62. `Plot Point Transition Threshold`
    - Type: label
    - Tooltip: Confidence threshold used when judging progression readiness.
63. `transition_threshold`
    - Type: range input
64. `transition_threshold_value`
    - Type: slider value display
    - No tooltip
65. `Reset`
    - Type: button
    - Tooltip: Restore a field to its in-code default value.
66. `Plot Progression Rules`
    - Type: label
    - Tooltip: Currently objective-based progression only.
67. `advancement_mode`
    - Type: select input
    - Input option:
      - `Objective-based`

### Plot control row
68. `First Plot Point`
    - Type: button
    - No tooltip
69. `Previous Plot Point`
    - Type: button
    - No tooltip
70. `Next Plot Point`
    - Type: button
    - No tooltip

### Secondary controls grid
71. `Plot Alignment Strictness`
    - Type: label
    - Tooltip: How tightly guidance should adhere to the current plot point.
72. `strictness`
    - Type: range input
73. `strictness_value`
    - Type: slider value display
    - No tooltip
74. `Reset`
    - Type: button
    - Tooltip: Restore a field to its in-code default value.
75. `Plot Progression Aggressiveness`
    - Type: label
    - Tooltip: How strongly guidance should push toward progression when allowed.
76. `pacing_bias`
    - Type: range input
77. `pacing_bias_value`
    - Type: slider value display
    - No tooltip
78. `Reset`
    - Type: button
    - Tooltip: Restore a field to its in-code default value.
79. `Plot Foreshadowing`
    - Type: label
    - Tooltip: Whether guidance may seed the next plot point before full progression.
80. `Enabled`
    - Type: checkbox label
    - Tooltip: Whether guidance may seed the next plot point before full progression.
81. `Plot Stagnation`
    - Type: label
    - Tooltip: Whether clear conversational support for remaining on the current plot point should be honored.
82. `Allowed`
    - Type: checkbox label
    - Tooltip: Whether clear conversational support for remaining on the current plot point should be honored.

---

## Card 5 - Status

83. `Status`
    - Type: section title
    - Tooltip: Show per-message diagnostic/state surfaces in chat.
84. `aspect_destinia_status`
    - Type: rendered status container
    - Live rendered surfaces may include:
      - `Current Plot Point`
      - `Next Plot Point`
      - `Plot Progression`
      - `Plot Progression Evaluation`
      - reason text
      - `Current Objectives`
    - No per-subfield tooltip mapping currently documented in live wiring

---

## Card 6 - Injected Guidance Fields

85. `Injected Guidance Fields`
    - Type: section title
    - Tooltip: Editable text templates and instructions used to build the injected guidance and evaluator behavior.

### Fields in order
86. `Injection Intro`
    - Type: label
    - Tooltip: Editable text template used as the opening instruction block for injected Destinia guidance.
87. `guidance_intro`
    - Type: textarea
    - Input: multiline text
88. `Reset`
    - Type: button
    - Tooltip: Restore a field to its in-code default value.

89. `Guidance Principles`
    - Type: label
    - Tooltip: Editable principles that define how Destinia should balance plot guidance, immersion, and user agency.
90. `guidance_principles`
    - Type: textarea
    - Input: multiline text
91. `Reset`
    - Type: button
    - Tooltip: Restore a field to its in-code default value.

92. `Current Plot Point Template`
    - Type: label
    - Tooltip: Template used to inject the active plot point's identifying details, summary, steering, and pace.
93. Warning icon
    - Type: validation indicator
94. `current_plot_point_template`
    - Type: textarea
95. `Reset`
    - Type: button
    - Tooltip: Restore a field to its in-code default value.

96. `Next Plot Point Template`
    - Type: label
    - Tooltip: Template used to inject the upcoming plot point information when foreshadowing or transition context is allowed.
97. Warning icon
    - Type: validation indicator
98. `next_plot_point_template`
    - Type: textarea
99. `Reset`
    - Type: button
    - Tooltip: Restore a field to its in-code default value.

100. `Transition Template`
    - Type: label
    - Tooltip: Template used to describe the transition requirements between the current and next plot point.
101. Warning icon
    - Type: validation indicator
102. `transition_template`
    - Type: textarea
103. `Reset`
    - Type: button
    - Tooltip: Restore a field to its in-code default value.

104. `Objective Mode Template`
    - Type: label
    - Tooltip: Template used when objective-based progression rules are active for the current plot point.
105. Warning icon
    - Type: validation indicator
106. `objective_mode_template`
    - Type: textarea
107. `Reset`
    - Type: button
    - Tooltip: Restore a field to its in-code default value.

108. `Stagnation Instruction`
    - Type: label
    - Tooltip: Instruction appended when evaluation indicates the story should remain on the current plot point.
109. Warning icon
    - Type: validation indicator
110. `stagnation_instruction`
    - Type: textarea
111. `Reset`
    - Type: button
    - Tooltip: Restore a field to its in-code default value.

112. `Progression Instruction`
    - Type: label
    - Tooltip: Instruction appended when evaluation indicates the story may move toward the next plot point.
113. Warning icon
    - Type: validation indicator
114. `progression_instruction`
    - Type: textarea
115. `Reset`
    - Type: button
    - Tooltip: Restore a field to its in-code default value.

116. `Pacing Instruction`
    - Type: label
    - Tooltip: Template describing how strictness and pacing-bias settings should affect guidance behavior.
117. Warning icon
    - Type: validation indicator
118. `pacing_instruction`
    - Type: textarea
119. `Reset`
    - Type: button
    - Tooltip: Restore a field to its in-code default value.

120. `Objective Completion Guidance`
    - Type: label
    - Tooltip: Evaluator guidance explaining how to judge objective completion from recent chat evidence.
121. Warning icon
    - Type: validation indicator
122. `objective_completion_guidance`
    - Type: textarea
123. `Reset`
    - Type: button
    - Tooltip: Restore a field to its in-code default value.

124. `Foreshadowing Template`
    - Type: label
    - Tooltip: Template used when the next plot point may be lightly seeded before full progression.
125. Warning icon
    - Type: validation indicator
126. `foreshadowing_template`
    - Type: textarea
127. `Reset`
    - Type: button
    - Tooltip: Restore a field to its in-code default value.

128. `Timeline Deviation Instruction`
    - Type: label
    - Tooltip: Instruction used when deviation from the planned timeline is allowed.
129. Warning icon
    - Type: validation indicator
130. `timeline_deviation_instruction`
    - Type: textarea
131. `Reset`
    - Type: button
    - Tooltip: Restore a field to its in-code default value.

132. `Auto-Resolve Deviation Instruction`
    - Type: label
    - Tooltip: Instruction used when deviation is allowed and Destinia should gradually guide the story back on track.
133. Warning icon
    - Type: validation indicator
134. `auto_resolve_deviation_instruction`
    - Type: textarea
135. `Reset`
    - Type: button
    - Tooltip: Restore a field to its in-code default value.

136. `Guidance Outro`
    - Type: label
    - Tooltip: Editable closing instruction appended to the main injected guidance block.
137. `guidance_outro`
    - Type: textarea
138. `Reset`
    - Type: button
    - Tooltip: Restore a field to its in-code default value.

139. `Evaluator Prompt`
    - Type: label
    - Tooltip: The evaluator prompt template that judges progression, stagnation, confidence, and objective completion.
140. Warning icon
    - Type: validation indicator
141. `evaluator_prompt`
    - Type: textarea (`tall`, code-style)
142. `Reset`
    - Type: button
    - Tooltip: Restore a field to its in-code default value.

---

## Card 7 - Guidance Injection Settings

143. `Guidance Injection Settings`
    - Type: section title
    - Tooltip: Controls where the main live Destinia guidance prompt is inserted into prompt assembly for generation. This is the active timeline-guidance injection that tells the LLM what the current plot point, objectives, and guidance instructions are.

### Placement field
144. `Guidance Placement`
    - Type: label
    - Tooltip: Controls where the main live Destinia guidance prompt is inserted into prompt assembly for generation. This is the active timeline-guidance injection that tells the LLM what the current plot point, objectives, and guidance instructions are.
145. `Before Main Prompt`
    - Type: radio label
    - Tooltip: Controls where the main live Destinia guidance prompt is inserted into prompt assembly for generation. This is the active timeline-guidance injection that tells the LLM what the current plot point, objectives, and guidance instructions are.
146. `After Main Prompt`
    - Type: radio label
    - Tooltip: Controls where the main live Destinia guidance prompt is inserted into prompt assembly for generation. This is the active timeline-guidance injection that tells the LLM what the current plot point, objectives, and guidance instructions are.
147. `In Chat at Depth`
    - Type: radio label
    - Tooltip: Controls where the main live Destinia guidance prompt is inserted into prompt assembly for generation. This is the active timeline-guidance injection that tells the LLM what the current plot point, objectives, and guidance instructions are.
148. `guidance_depth`
    - Type: inline numeric input
    - No tooltip
149. `as`
    - Type: inline static text
    - No tooltip
150. `guidance_role`
    - Type: inline select input
    - No tooltip
    - Input options:
      - `System`
      - `User`
      - `Assistant`
151. `Include in World Info Scanning`
    - Type: checkbox label
    - Tooltip: Whether the injected prompt should participate in world-info scanning when SillyTavern builds context.

### Actions
152. `Fresh Reset Extension`
    - Type: button
    - No tooltip bubble
153. `Download Debug Log`
    - Type: button
    - No tooltip bubble

### Footer
154. `version 0.2.1`
    - Type: footer text
    - No tooltip
155. `Genisai`
    - Type: footer text
    - No tooltip

---

## Card 8 - Misc.

156. `Misc.`
    - Type: section title
    - Tooltip: Enable console logging plus in-memory trace collection for exported debug logs.
157. `Display Message State`
    - Type: checkbox label
    - Tooltip: Show per-message diagnostic/state surfaces in chat.
158. `Refresh Guidance Before Generation`
    - Type: checkbox label
    - Tooltip: Whether Destinia should explicitly rebuild and re-register its guidance on the pre-generation event, so the latest current plot state and settings are injected right before the LLM generates a response.
159. `Enable Guidance in New Chats`
    - Type: checkbox label
    - Tooltip: Default enabled state for new chats.
160. `Use Global Toggle State`
    - Type: checkbox label
    - Tooltip: Use one shared enabled/disabled toggle state instead of per-chat state.
161. `Notify on Switch`
    - Type: checkbox label
    - Tooltip: Show a toast when profiles switch.
162. `Debug Mode`
    - Type: checkbox label
    - Tooltip: Enable console logging plus in-memory trace collection for exported debug logs.
163. `Refresh Guidance`
    - Type: button
    - No tooltip
164. `Revert Settings`
    - Type: button
    - No tooltip

---

## Current Notes

- This file reflects the current live settings UI ordering, not a proposed redesign.
- Regular action buttons are listed because they are part of the visible UI, even when they do not currently have tooltip bubbles.
- Reset buttons are included because they are injected into the live UI and are part of the actual current settings surface.
- `Fresh Reset Extension` and `Download Debug Log` are intentionally listed as having no tooltip bubble, matching the current live implementation.
- `guidance_depth` and `guidance_role` are included in-place under `In Chat at Depth`, matching the live inline layout.
