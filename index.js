// ============================================================================
// ============================================================================
// SillyTavern Extension - Aspect: Destinia                  created by Genisai
// ============================================================================
// ============================================================================

// ============================================================================
// Section 1. Imports
// ============================================================================
// Owns all external dependencies used by this extension file.
// Keep this section limited to import statements only.
//
// Organization:
// - SillyTavern utility helpers
// - SillyTavern core script APIs
// - Extension/context APIs
// - Preset, instruct, group-chat, constants, and i18n helpers
// ============================================================================

// SillyTavern utility helpers.
import {
    getStringHash,
    debounce,
    download,
    parseJsonFile,
    waitUntilCondition
} from '../../../utils.js';

// SillyTavern core script APIs.
import {
    animation_duration,
    scrollChatToBottom,
    extension_prompt_roles,
    extension_prompt_types,
    saveSettingsDebounced,
    chat_metadata,
    generateRaw,
    generateQuietPrompt,
    getMaxContextSize,
    streamingProcessor,
    amount_gen,
    CONNECT_API_MAP,
    messageFormatting,
} from '../../../../script.js';

// Extension context and settings APIs.
import {
	getContext,
	extension_settings,
	saveMetadataDebounced
} from '../../../extensions.js';

// Preset, instruct-mode, group-chat, constants, and translation helpers.
import { getPresetManager } from '../../../preset-manager.js'
import { formatInstructModeChat } from '../../../instruct-mode.js';
import { selected_group } from '../../../group-chats.js';
import { debounce_timeout } from '../../../constants.js';
import { t, translate } from '../../../i18n.js';

export { MODULE_NAME };

// ============================================================================
// Section 2. Module Identity and DOM Constants
// ============================================================================
// Owns the extension's stable identity, settings namespace, display name,
// root DOM id, and shared CSS/DOM selector constants.
//
// These values are referenced throughout the extension by settings storage,
// chat metadata, message diagnostics, settings UI rendering, and DOM lookup.
//
// Keep this section limited to identity constants and selector/class constants.
// ============================================================================

// Extension namespace.
// Changing this changes where SillyTavern stores extension settings, metadata,
// message data, macros, and other module-scoped records.
const MODULE_NAME = 'aspect_destinia';

// Human-readable extension name used in logs, toasts, diagnostics, and UI text.
const MODULE_NAME_FANCY = 'Aspect: Destinia';

// Root DOM id for the extension settings/content container.
const ROOT_ID = 'aspect_destinia_root';

// Shared CSS class and DOM selector constants.
const css_message_div = 'aspect_destinia_display';
const state_div_class = 'aspect_destinia_text';
const settings_div_id = 'aspect_destinia_settings';
const settings_content_class = 'aspect_destinia_settings_content';

// ============================================================================
// Section 3. Help Text and Static UI Copy
// ============================================================================
// Owns human-facing descriptions used by settings labels, info tips, and help UI.
// ============================================================================

const LABEL_HELP = Object.freeze({
    // General extension/profile controls.
    extension_enabled: 'Turns Destinia guidance generation on or off for the selected profile.',
    profile: 'The currently loaded configuration profile.',
    current_chat: 'The known-chat attachment target for the selected profile.',

    // Evaluator connection and evidence controls.
    evaluator_connection_profile: 'Which connection profile the separate evaluator request uses.',
    evaluator_chat_completion_preset: 'Which completion preset the separate evaluator request uses.',
    recent_messages_to_evaluate: 'How many recent chat messages are included in evaluator evidence.',
    messages_evaluated: 'Which message types are included in evaluator evidence (`User`, `Assistant`, or `Both`).',
    evaluation_cooldown_enabled: 'When enabled, enforces a minimum gap between evaluator requests to reduce burst traffic and rate-limit errors.',
    evaluation_cooldown_seconds: 'The minimum number of seconds to wait between evaluator requests when cooldown is enabled.',
    evaluation_delay_seconds: 'How long to wait after the assistant response finishes before starting evaluation.',

    // Timeline editor and preset controls.
    timeline: 'The editable JSON source of truth for live story structure, plot points, objectives, and transitions.',
    timeline_preset: 'A saved timeline snapshot that can be selected, overwritten, duplicated, imported, or exported.',
    reset: 'Restore a field to its in-code default value.',
    repair: 'Rebuild Timeline JSON into the current live schema by removing invalid/outdated structure and adding missing required structure.',
    reset_objectives: 'Set all objective `completed` booleans in the visible Timeline JSON to `false`.',

    // Timeline behavior controls.
    timeline_deviation: 'Allows the story to move off-script from the planned timeline.',
    timeline_deviation_auto_resolve: 'Attempts to guide the story back toward the timeline after deviation.',
    detach: 'Allows plot progression to continue apart from the user\'s active scene.',
    detach_instruction: 'Guidance text explaining how detached progression should behave.',

    // Progression and objective evaluation controls.
    progression_rule: 'Selects what can trigger plot progression: clear user intent, objective completion threshold, either one, or both together.',
    objective_auto_advance_threshold: 'The completion ratio required before objective completion can trigger plot progression.',
    objective_evaluation_method: 'Chooses whether objective completion comes from the integrated evaluator response or per-objective checks.',
    plot_alignment_strictness: 'How tightly guidance should adhere to the current plot point.',
    plot_progression_aggressiveness: 'How strongly guidance should push toward progression when allowed.',
    plot_foreshadowing: 'Whether guidance may seed the next plot point before full progression.',

    // Editable guidance/evaluator template fields.
    injected_guidance_fields: 'Editable text templates and instructions used to build the injected guidance and evaluator behavior.',
    injection_intro: 'Editable text template used as the opening instruction block for injected Destinia guidance.',
    guidance_principles: 'Editable principles that define how Destinia should balance plot guidance, immersion, and user agency.',
    current_plot_point_template: 'Template used to inject the active plot point\'s identifying details, summary, steering, and pace.',
    next_plot_point_template: 'Template used to inject the upcoming plot point information when foreshadowing or transition context is allowed.',
    transition_template: 'Template used to describe the transition requirements between the current and next plot point.',
    objective_guidance_template: 'Template used to present the current plot point objectives as guidance for the assistant.',
    intent_progression_rule: 'Rule text that defines what counts as clear user intent to move into the next plot point.',
    progression_instruction: 'Instruction appended when evaluation indicates the story may move toward the next plot point.',
    pacing_instruction: 'Template describing how strictness and pacing-bias settings should affect guidance behavior.',
    objective_completion_guidance: 'Evaluator guidance explaining how to judge objective completion from recent chat evidence.',
    foreshadowing_template: 'Template used when the next plot point may be lightly seeded before full progression.',
    timeline_deviation_instruction: 'Instruction used when deviation from the planned timeline is allowed.',
    auto_resolve_deviation_instruction: 'Instruction used when deviation is allowed and Destinia should gradually guide the story back on track.',
    guidance_outro: 'Editable closing instruction appended to the main injected guidance block.',
    evaluator_prompt: 'The evaluator prompt template that judges progression, stagnation, confidence, and objective completion.',

    // Guidance injection controls.
    guidance_placement: 'Controls where the main live Destinia guidance prompt is inserted into prompt assembly for generation. This is the active timeline-guidance injection that tells the LLM what the current plot point, objectives, and guidance instructions are.',
    include_in_world_info_scanning: 'Whether the injected prompt should participate in world-info scanning when SillyTavern builds context.',

    // Debugging and miscellaneous controls.
    fresh_reset_extension: 'Reset current-chat Destinia state for fresh testing without deleting profiles or presets.',
    download_debug_log: 'Export the in-memory debug trace collected while `Debug Mode` is enabled.',
    display_message_state: 'Show per-message diagnostic/state surfaces in chat.',
    enable_guidance_in_new_chats: 'Default enabled state for new chats.',
    use_global_toggle_state: 'Use one shared enabled/disabled toggle state instead of per-chat state.',
    notify_on_switch: 'Show a toast when profiles switch.',
    debug_mode: 'Enable console logging plus in-memory trace collection for exported debug logs.',
});

// ============================================================================
// Section 4. Timeline Schema, Defaults, and Template Validation
// ============================================================================
// Owns static timeline defaults, evaluator prompt defaults, required timeline
// fields, and template validation rules.
// ============================================================================

// -----------------------------------------------------------------------------
// Timeline Schema - Default Timeline Template
// -----------------------------------------------------------------------------
// Canonical starter timeline used for new installs, repair fallback, and invalid
// timeline recovery. This object is a static template, not live timeline state.

const DEFAULT_TIMELINE_TEMPLATE = {
    storyTitle: 'Your Story Title',
    systemStyle: 'Describe only the global storytelling style rules that should apply throughout the timeline. Include the tone, canon strictness, pacing feel, narration/dialogue style, and how flexible the roleplay may be. Keep this specific and directive rather than broad or flowery. Avoid repeating plot events, character biographies, or arc summaries here.',
    currentPlotPoint: 'plot-point-1',
    transitionFrom: null,
    transitionTo: null,
    plotPoints: [
        {
            id: 'plot-point-1',
            title: 'Opening Situation',
            summary: 'Describe the current narrative stage and what the cast is generally dealing with.',
            objectives: [
                'Establish the setting and immediate situation.',
                'Surface the main character motivations that matter for this phase.',
                'Allow the user to meaningfully interact with the current story situation.',
            ],
            steeringPrompt: 'Keep the narrative focused on the opening situation while remaining flexible to the user’s choices.',
            pace: 'medium',
            delayable: true,
        },
        {
            id: 'plot-point-2',
            title: 'First Escalation',
            summary: 'Describe the next major development or escalation.',
            objectives: [
                'Introduce the next complication or escalation naturally.',
                'Preserve continuity from the prior plot point.',
                'Let the user influence how the transition feels.',
            ],
            steeringPrompt: 'Transition naturally into the escalation without making the shift feel abrupt or forced.',
            pace: 'medium',
            delayable: true,
        },
    ],
};

// -----------------------------------------------------------------------------
// Timeline Schema - Evaluator Prompt Defaults
// -----------------------------------------------------------------------------
// Canonical default evaluator prompts. These define expected JSON response shape
// and the static instructions used when profiles do not override evaluator text.

const DEFAULT_EVALUATOR_PROMPT = `You are evaluating roleplay progression for a story timeline controller.
Read the recent chat and determine whether the current plot point should remain active or whether transition state should be set.
Only mark objectives complete when the conversation meaningfully demonstrates progress. Do not mark completion from weak implication alone.
Treat each objective independently by index. Mark an objective true only when the evaluated messages provide direct evidentiary support that the objective is actually fulfilled. If the evidence is ambiguous, indirect, incomplete, or better fits a different objective, leave that objective false. Do not infer completion from theme, tone, relevance, likely future outcomes, or general plot adjacency.
{{objectiveCompletionGuidance}}
Apply the active plot progression rule exactly as written below.
{{progressionRuleInstruction}}
Return ONLY valid JSON with these keys:
{
  "decision": "stagnate" | "progress",
  "confidence": 0.0,
  "reason": "short explanation",
  "objective_completion": [true, false],
  "objective_reasons": ["short explanation per objective", "short explanation per objective"]
}
Story title: {{storyTitle}}
Story style: {{storyStyle}}
Current plot point title: {{currentTitle}}
Current plot point summary: {{currentSummary}}
Current objectives: {{currentObjectives}}
Current objective completion booleans: {{currentObjectiveCompletion}}
Objective completion trigger threshold: {{objectiveCompletionTriggerThreshold}}
Next plot point title: {{nextTitle}}
Next plot point summary: {{nextSummary}}
Recent chat selected for evaluation:
{{recentChat}}`;

const DEFAULT_TRANSITION_COMPLETION_PROMPT = `You are evaluating whether an active story transition has completed.
Read the recent chat and determine whether the transition from the source plot point to the destination plot point has actually completed in the narrative.
Judge completion based on whether the story has meaningfully bridged from source context into destination context.
Return ONLY valid JSON with these keys:
{
  "decision": "incomplete" | "complete",
  "confidence": 0.0,
  "reason": "short explanation"
}
Story title: {{storyTitle}}
Story style: {{storyStyle}}
Transition source plot point title: {{sourceTitle}}
Transition source plot point summary: {{sourceSummary}}
Transition destination plot point title: {{destinationTitle}}
Transition destination plot point summary: {{destinationSummary}}
Transition guidance: {{transitionGuidance}}
Recent chat selected for evaluation:
{{recentChat}}`;

// Shared evaluator prompt migration/evidence rules.
// These are static text fragments used when normalizing older saved profiles.
const EVALUATOR_OBJECTIVE_BASE_RULE = 'Only mark objectives complete when the conversation meaningfully demonstrates progress. Do not mark completion from weak implication alone.';

const EVALUATOR_OBJECTIVE_EVIDENCE_RULE = 'Treat each objective independently by index. Mark an objective true only when the evaluated messages provide direct evidentiary support that the objective is actually fulfilled. If the evidence is ambiguous, indirect, incomplete, or better fits a different objective, leave that objective false. Do not infer completion from theme, tone, relevance, likely future outcomes, or general plot adjacency.';

// -----------------------------------------------------------------------------
// Timeline Schema - Required Structure
// -----------------------------------------------------------------------------
// Field declarations used by timeline validation and repair logic.
// These describe required shape only; they do not validate by themselves.

const TIMELINE_REQUIRED_TOP_LEVEL_FIELDS = Object.freeze([
    { key: 'storyTitle', label: 'storyTitle' },
    { key: 'systemStyle', label: 'systemStyle' },
    { key: 'currentPlotPoint', label: 'currentPlotPoint' },
    { key: 'transitionFrom', label: 'transitionFrom' },
    { key: 'transitionTo', label: 'transitionTo' },
    { key: 'plotPoints', label: 'plotPoints[]', isArray: true },
]);

const TIMELINE_REQUIRED_PLOT_POINT_FIELDS = Object.freeze([
    { key: 'title', label: 'title' },
    { key: 'summary', label: 'summary' },
    { key: 'objectives', label: 'objectives[]', isArray: true },
    { key: 'steeringPrompt', label: 'steeringPrompt' },
    { key: 'pace', label: 'pace' },
]);

// -----------------------------------------------------------------------------
// Timeline Schema - Template Validation Rules
// -----------------------------------------------------------------------------
// Static field validation metadata used by settings/template validation UI.

const TEMPLATE_VALIDATION_RULES = Object.freeze({
    timeline_text: {
        type: 'json',
        label: 'Timeline JSON',
    },
    guidance_intro: {
        type: 'template',
        label: 'Injection Intro',
    },
    guidance_principles: {
        type: 'template',
        label: 'Guidance Principles',
    },
    current_plot_point_template: {
        type: 'template',
        label: 'Current Plot Point Template',
        requiredTokens: ['{{storyTitle}}', '{{storyStyle}}', '{{currentIndex}}', '{{totalPlotPoints}}', '{{currentTitle}}', '{{currentSummary}}', '{{currentSteering}}', '{{currentPace}}'],
    },
    next_plot_point_template: {
        type: 'template',
        label: 'Next Plot Point Template',
        requiredTokens: ['{{nextTitle}}', '{{nextSummary}}'],
    },
    evaluator_prompt: {
        type: 'template',
        label: 'Evaluator Prompt',
        requiredTokens: ['{{storyTitle}}', '{{storyStyle}}', '{{currentTitle}}', '{{currentSummary}}', '{{currentObjectives}}', '{{currentObjectiveCompletion}}', '{{nextTitle}}', '{{nextSummary}}', '{{recentChat}}', '{{objectiveCompletionGuidance}}'],
    },
    transition_template: {
        type: 'template',
        label: 'Transition Template',
        requiredTokens: ['{{transitionGuidance}}'],
    },
    objective_guidance_template: {
        type: 'template',
        label: 'Objective Guidance Template',
        requiredTokens: ['{{currentObjectives}}'],
    },
    intent_progression_rule: {
        type: 'template',
        label: 'Intent Progression Rule',
    },
    progression_instruction: {
        type: 'template',
        label: 'Progression Instruction',
    },
    pacing_instruction: {
        type: 'template',
        label: 'Pacing Instruction',
        requiredTokens: ['{{strictness}}', '{{pacingBias}}'],
    },
    objective_completion_guidance: {
        type: 'template',
        label: 'Objective Completion Guidance',
        requiredTokens: ['objective'],
    },
    foreshadowing_template: {
        type: 'template',
        label: 'Foreshadowing Template',
        requiredTokens: ['{{nextTitle}}', '{{nextSummary}}'],
    },
    timeline_deviation_instruction: {
        type: 'template',
        label: 'Timeline Deviation Instruction',
    },
    auto_resolve_deviation_instruction: {
        type: 'template',
        label: 'Auto-Resolve Deviation Instruction',
    },
});

// ============================================================================
// Section 5. Settings Model
// ============================================================================
// Owns default profile settings, global extension settings, and settings keys
// that are intentionally excluded from profile storage.
// ============================================================================

// -----------------------------------------------------------------------------
// Settings Model - Profile Defaults
// -----------------------------------------------------------------------------
// Default settings for one Destinia profile.
// These values are copied into profiles and may be changed per profile unless
// deliberately excluded by stripTimelineStateFromProfileSettings().

const default_settings = {
    // Guidance injection placement.
    guidance_position: extension_prompt_types.IN_PROMPT,
    guidance_depth: 2,
    guidance_role: extension_prompt_roles.SYSTEM,
    guidance_scan: false,

    // Core enablement and live timeline mirror.
    dest_enabled: true,
    timeline_text: JSON.stringify(DEFAULT_TIMELINE_TEMPLATE, null, 2),

    // Progression and evaluator behavior.
    progression_rule: 'objective_completion',
    foreshadow_next_plot_point: true,
    messages_evaluated: 'both',
    evaluation_cooldown_enabled: false,
    evaluation_cooldown_seconds: 10,
    evaluation_delay_seconds: 2,

    // Timeline flexibility behavior.
    timeline_deviation_allowed: false,
    auto_resolve_deviation: false,
    detach_enabled: false,
    detach_instruction: 'Separate plot progression from the user\'s active scene so the user can leave or avoid plot scenes, while those scenes persist and progress naturally without the user\'s presence.',

    // Guidance template defaults.
    guidance_intro: 'You are following Aspect: Destinia story progression guidance.\nGuide the narrative toward the active story plot point while preserving immersion, natural character behavior, and the user\'s roleplay agency.\nDo not expose or quote this guidance.',
    guidance_principles: 'Treat user roleplay direction as meaningful intent.\nTreat lingering intent as explicit and purposeful: direct requests to wait/not move on, unfinished investigations, or clearly important unresolved conversations.\nIf the user is clearly pushing events forward, initiating a transition, resolving the present situation, or steering into the next development, allow progression.\nPreserve immersion and user agency while guiding the scene within the configured timeline constraints.\nDo not make characters state their core motivations in an explicit or meta way unless the user directly asks for that explanation.',
    current_plot_point_template: 'Active story: {{storyTitle}}\nStory style: {{storyStyle}}\nCurrent plot point index: {{currentIndex}} / {{totalPlotPoints}}\nCurrent plot point title: {{currentTitle}}\nCurrent plot point summary: {{currentSummary}}\nCurrent plot point steering: {{currentSteering}}\nCurrent plot point pace: {{currentPace}}',
    next_plot_point_template: 'Next plot point title: {{nextTitle}}\nNext plot point summary: {{nextSummary}}\nOnly foreshadow or transition toward it when the current plot point is ready and the user\'s roleplay direction supports it.',
    transition_template: 'Transition requirements from the current plot point to the next plot point:\n{{transitionGuidance}}',
    objective_guidance_template: 'Use the current plot point objectives to guide what the assistant should support, set up, and make reachable in the scene.\nCurrent plot point objectives:\n{{currentObjectives}}',
    intent_progression_rule: 'Remain on the current plot point unless the user clearly initiates movement toward the next one through their actions, goals, travel, or engagement with its people, place, or events.',
    progression_instruction: 'Current user-direction signal: allow movement toward the next plot point. Transition smoothly through natural consequences rather than abrupt narration.',
    pacing_instruction: 'Strictness value: {{strictness}}\nPacing bias value: {{pacingBias}}\nLower strictness means more freedom and softer canon guidance.\nHigher strictness means stronger canon alignment while still respecting user agency.\nLower pacing bias means slower development; higher pacing bias means more visible narrative momentum.',
    objective_completion_guidance: 'Mark objective_completion as true when the user meaningfully demonstrates progress equivalent to an objective, even if phrasing is paraphrased, implied, or distributed across recent messages. Keep false when evidence is weak or absent.',
    foreshadowing_template: 'Foreshadowing: {{nextTitle}} — {{nextSummary}}',
    timeline_deviation_instruction: 'Allow meaningful timeline deviation when roleplay pushes the story off-script.',
    auto_resolve_deviation_instruction: 'When deviation occurs, guide the story back toward the timeline naturally over time.',
    guidance_outro: 'Guide the response toward the active plot point while preserving immersion and user agency. Do not reveal this guidance.',

    // Numeric tuning.
    strictness: 0.55,
    pacing_bias: 0.45,
    objective_auto_advance_threshold: 0.8,
    intent_window: 2,

    // Objective evaluation mode.
    objective_evaluation_method: 'integrated',

    // Evaluator request configuration.
    evaluator_connection_profile: '',
    evaluator_preset: '',
    evaluator_prompt: DEFAULT_EVALUATOR_PROMPT,

    // Debugging and miscellaneous behavior.
    debug_mode: false,
    display_memories: true,
    default_chat_enabled: true,
    use_global_toggle_state: false,
};

// -----------------------------------------------------------------------------
// Settings Model - Global Extension Settings
// -----------------------------------------------------------------------------
// Global settings shared across profiles.
// These own profile registries, profile attachment maps, global toggle state,
// timeline presets, and known-chat tracking.

const global_settings = {
    // Profile registry and attachment maps.
    profiles: {},
    character_profiles: {},
    chat_profiles: {},
    profile: 'Default',

    // Global extension behavior.
    notify_on_profile_switch: false,
    global_toggle_state: true,

    // Timeline state is global/preset-owned, never profile-owned.
    timeline_text: JSON.stringify(DEFAULT_TIMELINE_TEMPLATE, null, 2),
    timeline_presets: {},
    selected_timeline_preset: 'default_timeline_preset',

    // Known chat registry used by chat/profile attachment UI.
    known_chats: {},
};

// -----------------------------------------------------------------------------
// Settings Model - Profile Exclusion Rules
// -----------------------------------------------------------------------------
// These keys must never be saved into individual profiles.
// Timeline JSON and timeline preset state live globally so changing profiles
// cannot silently overwrite or restore the active timeline.

const TIMELINE_STATE_KEYS = Object.freeze([
    'timeline_text',
    'timeline_presets',
    'selected_timeline_preset',
]);

function stripTimelineStateFromProfileSettings(settings = {}) {
    const stripped = structuredClone(settings || {});

    for (const key of TIMELINE_STATE_KEYS) {
        delete stripped[key];
    }

    return stripped;
}

// -----------------------------------------------------------------------------
// Settings Model - Settings UI Registry
// -----------------------------------------------------------------------------
// Runtime map of setting keys to bound UI elements.
// Defined here because it describes the settings model surface, but populated by
// Settings UI Binding and Refresh.

const settings_ui_map = {};

// ============================================================================
// Section 6. Runtime State
// ============================================================================
// Owns in-memory state that should not be directly persisted as settings.
// Includes diagnostic animation state, evaluator scheduling state, evaluator
// retry state, and other temporary execution flags.
// ============================================================================

// -----------------------------------------------------------------------------
// Runtime State - Debug Log Buffer
// -----------------------------------------------------------------------------
// In-memory debug trace storage. The buffer is exported by downloadDebugLog()
// and trimmed by append_debug_log().

const DEBUG_LOG_LIMIT = 400;
let debug_log_entries = [];

// -----------------------------------------------------------------------------
// Runtime State - Message Diagnostic Display
// -----------------------------------------------------------------------------
// Tracks temporary visual states for per-message diagnostics in chat.

let active_diagnostic_loading_index = null;
let active_diagnostic_loading_started_at = 0;
let finishing_diagnostic_index = null;

// -----------------------------------------------------------------------------
// Runtime State - Evaluator Scheduling
// -----------------------------------------------------------------------------
// Tracks delayed/cooldown evaluator execution so repeated chat events do not
// cause overlapping evaluator requests.

let lastEvaluationStartedAt = 0;
let scheduledEvaluationSequence = 0;
let scheduledEvaluationTask = Promise.resolve(null);

// Evaluator execution may send background requests through Connection Manager.
// Keep evaluator calls serialized so repeated events cannot overlap diagnostics
// or retry state.
let evaluatorExecutionQueue = Promise.resolve(null);

// -----------------------------------------------------------------------------
// Runtime State - Evaluator Duplicate and Retry Suppression
// -----------------------------------------------------------------------------
// Tracks evaluator evidence keys so unchanged evidence is not repeatedly
// evaluated, and recently failed provider calls are not spam-retried.

let activeEvaluationKey = '';
let lastEvaluationKey = '';
let lastFailedEvaluationKey = '';
let lastFailedEvaluationAt = 0;

// -----------------------------------------------------------------------------
// Runtime State - Group Evaluation Tracking
// -----------------------------------------------------------------------------
// Tracks pending group-chat user-message evaluation when evaluator scope is
// configured around user messages.

let pendingGroupUserEvaluationIndex = null;

// -----------------------------------------------------------------------------
// Runtime State - Connection Manager Detection
// -----------------------------------------------------------------------------
// Tracks whether SillyTavern Connection Manager profiles are available and
// whether detection has already been traced.

let connection_profiles_active = false;
let connection_profiles_ready = false;
let connectionManagerDetectTraceSignature = '';

// ============================================================================
// Aspect: Destinia — Logging, Debugging, and Toast Helpers
// ============================================================================
// Owns console output, debug trace capture, exported debug logs, and toast
// wrappers.
//
// Evaluator cooldown/locking helpers do not belong here; move those later into
// Evaluator System - Scheduling, Cooldown, and Duplicate Suppression.
// ============================================================================

function getFailedEvaluationRetryCooldownMs() {
    return getEvaluationCooldownMs();
}

async function withEvaluatorExecutionLock(task) {
    const previous = evaluatorExecutionQueue.catch(() => null);

    let release;
    const current = new Promise(resolve => {
        release = resolve;
    });

    evaluatorExecutionQueue = previous.then(() => current);

    await previous;

    try {
        return await task();
    } finally {
        release(null);
    }
}

function shouldSuppressFailedEvaluationRetry(evaluationKey) {
    if (!evaluationKey) return false;
    if (evaluationKey !== lastFailedEvaluationKey) return false;

    const cooldownMs = getFailedEvaluationRetryCooldownMs();

    // If Evaluation Cooldown is disabled, failed-key retry suppression is also disabled.
    if (cooldownMs <= 0) return false;

    return Date.now() - lastFailedEvaluationAt < cooldownMs;
}

function markEvaluationSucceeded(evaluationKey) {
    lastEvaluationKey = evaluationKey;

    if (lastFailedEvaluationKey === evaluationKey) {
        lastFailedEvaluationKey = '';
        lastFailedEvaluationAt = 0;
    }
}

function markEvaluationFailed(evaluationKey) {
    if (!evaluationKey) return;
    lastFailedEvaluationKey = evaluationKey;
    lastFailedEvaluationAt = Date.now();
}
function append_debug_log(level, args) {
    const entry = {
        timestamp: new Date().toISOString(),
        level,
        message: args.map((arg) => {
            if (typeof arg === 'string') return arg;
            try {
                return JSON.stringify(arg);
            } catch {
                return String(arg);
            }
        }).join(' '),
    };
    debug_log_entries.push(entry);
    if (debug_log_entries.length > DEBUG_LOG_LIMIT) {
        debug_log_entries = debug_log_entries.slice(-DEBUG_LOG_LIMIT);
    }
}
function downloadDebugLog() {
    const content = debug_log_entries.map((entry) => `[${entry.timestamp}] [${entry.level}] ${entry.message}`).join('\n');
    download(content || 'No debug log entries recorded.', 'aspect-destinia-debug.log', 'text/plain');
}
function trace_debug(label, payload = {}) {
    if (!get_settings('debug_mode')) return;
    append_debug_log('TRACE', [`${label}:`, payload]);
    log('[TRACE]', label, payload);
}
function log() {
    console.log(`[${MODULE_NAME_FANCY}]`, ...arguments);
}
function debug() {
    if (get_settings('debug_mode')) {
        append_debug_log('DEBUG', Array.from(arguments));
        log("[DEBUG]", ...arguments);
    }
}
function error() {
    append_debug_log('ERROR', Array.from(arguments));
    console.error(`[${MODULE_NAME_FANCY}]`, ...arguments);
    toastr.error(Array.from(arguments).join(' '), MODULE_NAME_FANCY);
}
function delay(ms) {
    return new Promise(res => setTimeout(res, ms));
}
function toast(message, type="info") {
    // debounce the toast messages
    toastr[type](message, MODULE_NAME_FANCY);
}
const toast_debounced = debounce(toast, 500);

const saveChatDebounced = debounce(() => getContext().saveChat(), debounce_timeout.relaxed);
function count_tokens(text, padding = 0) {
    // count the number of tokens in a text
    let ctx = getContext();
    return ctx.getTokenCount(text, padding);
}
function get_context_size() {
    // Get the current context size
    return getMaxContextSize();
}
function get_current_character_identifier() {
    let context = getContext();

    if (context.groupId) {
        return context.groupId;
    }

    let index = context.characterId;
    if (typeof index !== 'number' || !context.characters?.[index]) {
        return null;
    }

    return context.characters[index].avatar;
}
function getCharacterName(ctx = getContext()) {
    try {
        if (ctx.groupId) return `Group ${ctx.groupId}`;
        if (typeof ctx.characterId === 'number' && ctx.characters?.[ctx.characterId]) {
            return ctx.characters[ctx.characterId].name || `Character ${ctx.characterId}`;
        }
    } catch {
    }
    return 'Unknown Chat';
}
function getChatKey(ctx = getContext()) {
    const candidates = [
        ctx.chatId,
        ctx.chat_id,
        ctx.chatFileName,
        ctx.chatName,
        ctx.name2 && `${getCharacterName(ctx)}::${ctx.name2}`,
        ctx.groupId && `group:${ctx.groupId}`,
        typeof ctx.characterId === 'number' ? `char:${ctx.characterId}` : '',
    ].filter(Boolean);

    if (candidates.length > 0) {
        return `chat::${candidates[0]}`;
    }

    const messageSeed = (ctx.chat || [])
        .slice(0, 4)
        .map(m => `${m.name || ''}:${m.send_date || ''}:${String(m.mes || '').slice(0, 20)}`)
        .join('|');

    return `fallback::${getCharacterName(ctx)}::${messageSeed || 'empty'}`;
}
function getChatLabel(ctx = getContext()) {
    const characterLabel = getCharacterName(ctx);
    const secondary = ctx.chatName || ctx.name2 || ctx.chatId || ctx.chatFileName || 'Current Chat';
    return `${characterLabel} — ${secondary}`;
}
function registerKnownChat() {
    const knownChats = get_settings('known_chats', true) || {};
    const key = getChatKey();
    const previous = knownChats[key] || null;
    const next = {
        key,
        label: getChatLabel(),
        lastSeen: Date.now(),
    };
    if (previous && previous.label === next.label && Date.now() - Number(previous.lastSeen || 0) < 60000) {
        return;
    }
    knownChats[key] = next;
    set_settings('known_chats', knownChats);
}

function normalizeObjectiveItem(item) {
    if (typeof item === 'string') {
        return { text: item, completed: false };
    }
    if (item && typeof item === 'object') {
        return {
            text: String(item.text || '').trim(),
            completed: Boolean(item.completed)
        };
    }
    return { text: '', completed: false };
}
function normalizeDestiniaTimeline(raw) {
    if (!raw || typeof raw !== 'object') return structuredClone(DEFAULT_TIMELINE_TEMPLATE);
    const plotPoints = Array.isArray(raw.plotPoints) && raw.plotPoints.length ? raw.plotPoints : structuredClone(DEFAULT_TIMELINE_TEMPLATE.plotPoints);
    const normalizedPlotPoints = plotPoints.map((point, index) => {
        const objectives = Array.isArray(point?.objectives)
            ? point.objectives.map(normalizeObjectiveItem).filter(item => item.text)
            : [];
        return {
            id: String(point?.id || `plot-point-${index + 1}`),
            title: String(point?.title || `Plot Point ${index + 1}`),
            summary: String(point?.summary || ''),
            objectives,
            steeringPrompt: String(point?.steeringPrompt || ''),
            transitionGuidance: String(point?.transitionGuidance || '').trim() || 'Show the causal bridge from this plot point into the next plot point before the next plot point action fully begins.',
            pace: String(point?.pace || 'medium'),
            delayable: Boolean(point?.delayable),
        };
    });
    const validIds = new Set(normalizedPlotPoints.map(point => point.id));
    const firstValidId = normalizedPlotPoints[0]?.id || 'plot-point-1';
    const rawCurrentPlotPoint = String(raw.currentPlotPoint || '').trim();
    const currentPlotPoint = validIds.has(rawCurrentPlotPoint) ? rawCurrentPlotPoint : firstValidId;
    const rawTransitionFrom = raw.transitionFrom === null ? null : String(raw.transitionFrom || '').trim() || null;
    const rawTransitionTo = raw.transitionTo === null ? null : String(raw.transitionTo || '').trim() || null;
    let transitionFrom = rawTransitionFrom;
    let transitionTo = rawTransitionTo;
    const transitionPairValid = (
        transitionFrom !== null
        && transitionTo !== null
        && validIds.has(transitionFrom)
        && validIds.has(transitionTo)
        && transitionFrom !== transitionTo
    );
    if (!transitionPairValid) {
        transitionFrom = null;
        transitionTo = null;
    }
    return {
        storyTitle: String(raw.storyTitle || DEFAULT_TIMELINE_TEMPLATE.storyTitle),
        systemStyle: String(raw.systemStyle || DEFAULT_TIMELINE_TEMPLATE.systemStyle),
        currentPlotPoint,
        transitionFrom,
        transitionTo,
        plotPoints: normalizedPlotPoints,
    };
}
function validateTimelineStructure(timeline) {
    if (!timeline || typeof timeline !== 'object' || Array.isArray(timeline)) {
        return ['Timeline must be an object.'];
    }

    const issues = [];
    const missingTopLevel = TIMELINE_REQUIRED_TOP_LEVEL_FIELDS
        .filter(({ key, isArray }) => {
            if (!(key in timeline)) return true;
            if (isArray) return !Array.isArray(timeline[key]);
            if (key === 'transitionFrom' || key === 'transitionTo') {
                return !(timeline[key] === null || typeof timeline[key] === 'string');
            }
            return typeof timeline[key] !== 'string';
        })
        .map(field => field.label);

    if (missingTopLevel.length) {
        issues.push(`Missing required top-level fields: ${missingTopLevel.join(', ')}`);
    }

    if (!Array.isArray(timeline.plotPoints)) {
        return issues.length ? issues : ['Timeline must include plotPoints[].'];
    }

    timeline.plotPoints.forEach((point, index) => {
        if (!point || typeof point !== 'object' || Array.isArray(point)) {
            issues.push(`Plot point ${index + 1} must be an object.`);
            return;
        }

        const missingFields = TIMELINE_REQUIRED_PLOT_POINT_FIELDS
            .filter(({ key, isArray }) => {
                if (!(key in point)) return true;
                return isArray ? !Array.isArray(point[key]) : typeof point[key] !== 'string';
            })
            .map(field => field.label);

        if (missingFields.length) {
            issues.push(`Plot point ${index + 1} is missing required fields: ${missingFields.join(', ')}`);
        }
    });

    return issues;
}

function getValidatedTimelineText(rawText) {
    try {
        const parsed = JSON.parse(String(rawText || ''));
        const issues = validateTimelineStructure(parsed);
        if (issues.length) {
            return {
                timeline: structuredClone(DEFAULT_TIMELINE_TEMPLATE),
                timelineText: JSON.stringify(DEFAULT_TIMELINE_TEMPLATE, null, 2),
                valid: false,
                issues,
            };
        }
        const normalized = normalizeDestiniaTimeline(parsed);
        return {
            timeline: normalized,
            timelineText: JSON.stringify(normalized, null, 2),
            valid: true,
            issues: [],
        };
    } catch {
        return {
            timeline: structuredClone(DEFAULT_TIMELINE_TEMPLATE),
            timelineText: JSON.stringify(DEFAULT_TIMELINE_TEMPLATE, null, 2),
            valid: false,
            issues: ['Timeline must be valid JSON and include plotPoints[].'],
        };
    }
}

function removeRepeatedExactText(text, needle) {
    text = String(text || '');
    needle = String(needle || '');
    if (!needle) return text;

    const firstIndex = text.indexOf(needle);
    if (firstIndex < 0) return text;

    const keepEnd = firstIndex + needle.length;
    const beforeAndFirst = text.slice(0, keepEnd);
    const afterFirst = text.slice(keepEnd).split(needle).join('');

    return `${beforeAndFirst}${afterFirst}`;
}

function normalizeEvaluatorPromptSchema(rawPrompt = '') {
    let prompt = String(rawPrompt || '').trim();

    if (!prompt) {
        prompt = DEFAULT_EVALUATOR_PROMPT;
    }

    prompt = prompt
        .replaceAll(
            'that the USER is signaling that the story should stay on the current plot point or may transition toward the next plot point.',
            'whether the conversation should stagnate on the current plot point or progress toward the next plot point.'
        )
        .replaceAll(
            'Only mark objectives complete when the USER meaningfully demonstrates progress. Do not mark completion based only on assistant or NPC narration or dialogue.',
            EVALUATOR_OBJECTIVE_BASE_RULE
        )
        .replaceAll(
            'Only mark user_wants_to_linger as true when the user explicitly asks to delay progression, is clearly still working an unfinished in-plot-point task, or is engaged in an important unresolved conversation.',
            'Only mark plot_stagnation as true when the conversation clearly supports remaining on the current plot point, such as explicit requests to delay progression, clearly unfinished in-plot-point work, or an important unresolved conversation that should continue before progressing.'
        )
        .replaceAll('"decision": "stay" | "advance",', '"decision": "stagnate" | "progress",')
        .replaceAll('"user_wants_to_linger": true', '"plot_stagnation": true')
        .replaceAll(
            'Recent user/assistant chat selected for evaluation:\n{{recentChat}}\nRecent user-only chat (when present in the evaluation scope):\n{{recentUserChat}}',
            'Recent chat selected for evaluation:\n{{recentChat}}'
        )
        .replaceAll(
            'Recent user chat:\n{{recentUserChat}}\nRecent chat:\n{{recentChat}}',
            'Recent chat selected for evaluation:\n{{recentChat}}'
        )
        .replaceAll('Recent user chat:', 'Recent chat selected for evaluation:');

    // Repair already-corrupted saved profiles by preserving only the first exact evidence rule.
    prompt = removeRepeatedExactText(prompt, EVALUATOR_OBJECTIVE_EVIDENCE_RULE);

    // Upgrade legacy prompts once, without making future loads mutate the prompt again.
    if (prompt.includes(EVALUATOR_OBJECTIVE_BASE_RULE) && !prompt.includes(EVALUATOR_OBJECTIVE_EVIDENCE_RULE)) {
        prompt = prompt.replace(
            EVALUATOR_OBJECTIVE_BASE_RULE,
            `${EVALUATOR_OBJECTIVE_BASE_RULE}\n${EVALUATOR_OBJECTIVE_EVIDENCE_RULE}`
        );
    }

    // Safety pass after migration.
    prompt = removeRepeatedExactText(prompt, EVALUATOR_OBJECTIVE_EVIDENCE_RULE);

    // If the prompt is from an old incompatible schema, replace it with the current canonical schema.
    if (!prompt.includes('"objective_reasons"')) {
        prompt = DEFAULT_EVALUATOR_PROMPT;
    }

    return prompt
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function normalizeImportedProfile(data = {}) {
    const normalized = Object.assign(structuredClone(default_settings), structuredClone(data || {}));

    if (!('messages_evaluated' in normalized)) {
        normalized.messages_evaluated = normalized.include_user_messages_in_evaluation === false ? 'assistant' : 'both';
    }

    normalized.evaluator_prompt = normalizeEvaluatorPromptSchema(normalized.evaluator_prompt);

    // Profiles must never own, restore, or overwrite Timeline JSON.
    return stripTimelineStateFromProfileSettings(normalized);
}
function getTimelineEditorElement() {
    return document.querySelector(`.${settings_content_class} #timeline_text`);
}

function getLiveTimelineText() {
    const editor = getTimelineEditorElement();

    // When the editor contains valid JSON, treat it as the freshest source.
    // This makes manual Timeline JSON edits immediately visible to extension logic.
    if (editor) {
        const editorText = String(editor.value || '');
        const editorResult = getValidatedTimelineText(editorText);
        if (editorResult.valid) {
            return editorResult.timelineText;
        }
    }

    return get_settings('timeline_text');
}

function getDestiniaTimeline() {
    return getValidatedTimelineText(getLiveTimelineText()).timeline;
}

function commitTimelineText(rawTimelineText, options = {}) {
    const {
        updateEditor = true,
        refreshGuidanceNow = true,
        refreshStatusNow = true,
        showInvalidToast = true,
    } = options;

    ensureDefaultTimelinePreset();

    const timelineResult = getValidatedTimelineText(rawTimelineText);
    if (!timelineResult.valid) {
        if (showInvalidToast) {
            toast(`Timeline JSON not saved: ${timelineResult.issues.join('; ')}`, 'warning');
        }
        updateFieldValidationIndicators();
        updateTimelinePresetControls();
        return false;
    }

    const timelineText = timelineResult.timelineText;

    const presets = get_settings('timeline_presets', true) || {};
    let presetId = get_settings('selected_timeline_preset') || 'default_timeline_preset';

    if (!presets[presetId]) {
        presetId = 'default_timeline_preset';
        set_settings('selected_timeline_preset', presetId);
    }

    if (!presets[presetId]) {
        presets[presetId] = {
            name: 'Default Timeline',
            timelineText,
        };
    } else {
        presets[presetId] = {
            ...presets[presetId],
            timelineText,
        };
    }

    // timeline_text is now a live mirror of the selected preset.
    set_settings('timeline_text', timelineText);
    set_settings('timeline_presets', presets);

    // Programmatic mutations must be visible in the Timeline JSON editor.
    if (updateEditor) {
        const editor = getTimelineEditorElement();
        if (editor) {
            editor.value = timelineText;
        }
    }

    refresh_settings_for_timeline_controls();

    if (refreshStatusNow) {
        render_status_panel();
    }

    if (refreshGuidanceNow) {
        refresh_guidance();
    }

    return true;
}

function syncTimelineTextFromSelectedPreset(options = {}) {
    ensureDefaultTimelinePreset();

    const presets = get_settings('timeline_presets', true) || {};
    let presetId = get_settings('selected_timeline_preset') || 'default_timeline_preset';

    if (!presets[presetId]) {
        presetId = 'default_timeline_preset';
        set_settings('selected_timeline_preset', presetId);
    }

    const timelineText = String(
        presets[presetId]?.timelineText
        || JSON.stringify(DEFAULT_TIMELINE_TEMPLATE, null, 2)
    );

    return commitTimelineText(timelineText, {
        updateEditor: true,
        refreshGuidanceNow: true,
        refreshStatusNow: true,
        showInvalidToast: true,
        ...options,
    });
}
function persistObjectiveCompletionToTimeline(objectiveCompletion = []) {
    const timelineResult = getValidatedTimelineText(get_settings('timeline_text'));
    if (!timelineResult.valid) return;
    const timeline = timelineResult.timeline;
    const pointIndexById = new Map((timeline.plotPoints || []).map((point, index) => [point.id, index]));
    const currentIndex = pointIndexById.has(timeline.currentPlotPoint)
        ? pointIndexById.get(timeline.currentPlotPoint)
        : -1;
    const currentPoint = currentIndex >= 0 ? timeline.plotPoints?.[currentIndex] : null;
    if (!currentPoint || !Array.isArray(currentPoint.objectives)) return;

    currentPoint.objectives = currentPoint.objectives.map((objective, index) => {
        const normalized = normalizeObjectiveItem(objective);
        normalized.completed = Boolean(objectiveCompletion[index] ?? normalized.completed);
        return normalized;
    });

    const nextTimelineText = JSON.stringify(timeline, null, 2);
commitTimelineText(nextTimelineText);
}
function resetTimelineObjectivesToFalse() {
    const timelineResult = getValidatedTimelineText(get_settings('timeline_text'));
    if (!timelineResult.valid) return;
    const timeline = timelineResult.timeline;

    if (Array.isArray(timeline.plotPoints)) {
        timeline.plotPoints = timeline.plotPoints.map((plotPoint) => {
            if (!Array.isArray(plotPoint?.objectives)) return plotPoint;
            return {
                ...plotPoint,
                objectives: plotPoint.objectives.map((objective) => {
                    const normalized = normalizeObjectiveItem(objective);
                    normalized.completed = false;
                    return normalized;
                }),
            };
        });
    }

    const nextTimelineText = JSON.stringify(timeline, null, 2);
commitTimelineText(nextTimelineText);
}
function getCurrentPlotPoint() {
    const timeline = getDestiniaTimeline();
    const points = Array.isArray(timeline.plotPoints) ? timeline.plotPoints : [];
    const pointIndexById = new Map(points.map((point, index) => [point.id, index]));
    const currentIndex = pointIndexById.has(timeline.currentPlotPoint)
        ? pointIndexById.get(timeline.currentPlotPoint)
        : -1;
    const current = currentIndex >= 0 ? (points[currentIndex] || null) : null;
    const next = currentIndex >= 0 ? (points[currentIndex + 1] || null) : null;
    return {
        timeline,
        points,
        pointIndexById,
        currentIndex,
        current,
        next,
    };
}
function getTransitionState() {
    const timeline = getDestiniaTimeline();
    const points = Array.isArray(timeline.plotPoints) ? timeline.plotPoints : [];
    const pointById = new Map(points.map(point => [point.id, point]));
    const pointIndexById = new Map(points.map((point, index) => [point.id, index]));
    const transitionActive = Boolean(timeline.transitionFrom && timeline.transitionTo);
    const source = transitionActive ? (pointById.get(timeline.transitionFrom) || null) : null;
    const destination = transitionActive ? (pointById.get(timeline.transitionTo) || null) : null;
    const sourceIndex = transitionActive && pointIndexById.has(timeline.transitionFrom)
        ? pointIndexById.get(timeline.transitionFrom)
        : -1;
    const destinationIndex = transitionActive && pointIndexById.has(timeline.transitionTo)
        ? pointIndexById.get(timeline.transitionTo)
        : -1;
    const skippedPoints = (
        transitionActive
        && sourceIndex >= 0
        && destinationIndex >= 0
        && Math.abs(destinationIndex - sourceIndex) > 1
    )
        ? points.slice(Math.min(sourceIndex, destinationIndex) + 1, Math.max(sourceIndex, destinationIndex))
        : [];
    return {
        timeline,
        transitionActive,
        source,
        destination,
        sourceIndex,
        destinationIndex,
        skippedPoints,
    };
}
function getCurrentObjectiveCompletionState() {
    const { current } = getCurrentPlotPoint();
    const objectives = Array.isArray(current?.objectives) ? current.objectives : [];
    return objectives.map((objective) => Boolean(typeof objective === 'object' ? objective?.completed : false));
}
function buildDestiniaGuidance() {
    if (!get_settings('dest_enabled')) return '';
    const { timeline, current, next, currentIndex, points } = getCurrentPlotPoint();
    const transitionState = getTransitionState();
    if (!current && !transitionState.transitionActive) return '';

    const currentObjectiveLines = ((current?.objectives) || []).map(item => `- ${typeof item === 'string' ? item : item?.text || ''}`).filter(line => line !== '- ').join('\n') || '- None';
    const currentPlotTemplate = String(get_settings('current_plot_point_template') || 'Story: {{storyTitle}}\nStyle: {{storyStyle}}\nCurrent Plot Point: {{currentTitle}}\nCurrent Summary: {{currentSummary}}\nCurrent Steering: {{currentSteering}}\nCurrent Pace: {{currentPace}}')
        .replaceAll('{{storyTitle}}', timeline.storyTitle || '')
        .replaceAll('{{storyStyle}}', timeline.systemStyle || '')
        .replaceAll('{{currentIndex}}', String(currentIndex + 1))
        .replaceAll('{{totalPlotPoints}}', String(points.length || 0))
        .replaceAll('{{currentTitle}}', current?.title || '')
        .replaceAll('{{currentSummary}}', current?.summary || '')
        .replaceAll('{{currentSteering}}', current?.steeringPrompt || '')
        .replaceAll('{{currentPace}}', current?.pace || '');
    const objectiveGuidanceTemplate = String(get_settings('objective_guidance_template') || 'Current Objectives:\n{{currentObjectives}}')
        .replaceAll('{{currentObjectives}}', currentObjectiveLines);
    const pacingInstruction = String(get_settings('pacing_instruction') || 'Balance strictness and pacing bias so progression feels natural and coherent.')
        .replaceAll('{{strictness}}', String(get_settings('strictness')))
        .replaceAll('{{pacingBias}}', String(get_settings('pacing_bias')));

    if (!transitionState.transitionActive) {
        const nextPlotTemplate = String(get_settings('next_plot_point_template') || 'Next Plot Point: {{nextTitle}}\nNext Summary: {{nextSummary}}')
            .replaceAll('{{nextTitle}}', next?.title || 'None')
            .replaceAll('{{nextSummary}}', next?.summary || '');
        const foreshadowingTemplate = String(get_settings('foreshadowing_template') || 'Foreshadowing: {{nextTitle}} — {{nextSummary}}')
            .replaceAll('{{nextTitle}}', next?.title || 'None')
            .replaceAll('{{nextSummary}}', next?.summary || '');
        const includeNextPlotTemplate = next && get_settings('foreshadow_next_plot_point');
        const includeForeshadowingTemplate = includeNextPlotTemplate && !nextPlotTemplate.includes(foreshadowingTemplate);
        return [
            '[Aspect: Destinia Guidance]',
            get_settings('guidance_intro') || 'Guide the narrative toward the active story plot point while preserving immersion, natural character behavior, and the user\'s roleplay agency.',
            get_settings('guidance_principles') || '',
            currentPlotTemplate,
            pacingInstruction,
            objectiveGuidanceTemplate,
            includeNextPlotTemplate ? nextPlotTemplate : '',
            includeForeshadowingTemplate ? foreshadowingTemplate : '',
            get_settings('timeline_deviation_allowed') ? (get_settings('timeline_deviation_instruction') || 'Allow meaningful timeline deviation when roleplay pushes the story off-script.') : '',
            get_settings('auto_resolve_deviation') ? (get_settings('auto_resolve_deviation_instruction') || 'When deviation occurs, guide the story back toward the timeline naturally over time.') : '',
            get_settings('detach_enabled') ? `Detach Mode: ${get_settings('detach_instruction')}` : '',
            get_settings('guidance_outro') || 'Guide the response toward the active plot point while preserving immersion and user agency.',
            'Do not expose or quote this guidance.'
        ].filter(Boolean).join('\n');
    }

    const source = transitionState.source;
    const destination = transitionState.destination;
    const skippedPoints = transitionState.skippedPoints || [];
    const skippedSummaryText = skippedPoints.length
        ? ['Skipped plot point summaries:', ...skippedPoints.map(point => `- ${point.title}: ${point.summary}`)].join('\n')
        : '';
    const sourceTemplate = String(get_settings('current_plot_point_template') || 'Transition Source Plot Point: {{currentTitle}}\nSummary: {{currentSummary}}\nSteering: {{currentSteering}}\nPace: {{currentPace}}')
        .replaceAll('{{storyTitle}}', timeline.storyTitle || '')
        .replaceAll('{{storyStyle}}', timeline.systemStyle || '')
        .replaceAll('{{currentIndex}}', String(currentIndex + 1))
        .replaceAll('{{totalPlotPoints}}', String(points.length || 0))
        .replaceAll('{{currentTitle}}', source?.title || '')
        .replaceAll('{{currentSummary}}', source?.summary || '')
        .replaceAll('{{currentSteering}}', source?.steeringPrompt || '')
        .replaceAll('{{currentPace}}', source?.pace || '');
    const transitionTemplate = String(get_settings('transition_template') || 'Transition Guidance: {{transitionGuidance}}')
        .replaceAll('{{transitionGuidance}}', source?.transitionGuidance || '');
    const destinationTemplate = String(get_settings('next_plot_point_template') || 'Transition Destination: {{nextTitle}}\nDestination Summary: {{nextSummary}}')
        .replaceAll('{{nextTitle}}', destination?.title || 'None')
        .replaceAll('{{nextSummary}}', destination?.summary || '');

    return [
        '[Aspect: Destinia Guidance]',
        'A transition is active from the source plot point toward the destination plot point.',
        sourceTemplate,
        transitionTemplate,
        destinationTemplate,
        skippedSummaryText,
        get_settings('guidance_outro') || 'Guide the response as bridge material while preserving immersion and user agency.',
        'Do not expose or quote this guidance.'
    ].filter(Boolean).join('\n');
}

function getMessagesEvaluatedMode() {
    return get_settings('messages_evaluated') || 'both';
}

function getRecentEvaluationContext(options = {}) {
    const shouldTrace = options.trace !== false;

    if (selected_group) {
        return getGroupEvaluationContext({ trace: shouldTrace });
    }

    const recentChatSource = (getContext().chat || []).slice(-Math.max(1, Number(get_settings('intent_window')) || 8));
    const messagesEvaluated = getMessagesEvaluatedMode();

    let recentChat = recentChatSource;
    if (messagesEvaluated === 'user') {
        recentChat = recentChatSource.filter(message => message?.is_user);
    } else if (messagesEvaluated === 'assistant') {
        recentChat = recentChatSource.filter(message => !message?.is_user);
    }

    const recentUserChat = recentChatSource.filter(message => message?.is_user);

    const evaluationContext = {
        mode: messagesEvaluated,
        recentChat,
        recentUserChat,
        assistantBatch: recentChat.filter(message => !message?.is_user),
        targetMessage: recentChat[recentChat.length - 1] || null,
        generationId: null,
        turnStartIndex: null,
        firstBatchIndex: null,
        lastBatchIndex: null,
    };

    if (shouldTrace) {
        trace_debug('EvaluatorContext', {
            mode: evaluationContext.mode,
            totalRecentMessages: recentChatSource.length,
            evaluatedMessages: evaluationContext.recentChat.length,
            userMessagesAvailable: evaluationContext.recentUserChat.length,
            evaluatedCharacters: evaluationContext.recentChat.reduce((sum, message) => sum + String(message?.mes || '').length, 0),
        });
    }

    return evaluationContext;
}

function formatEvaluationMessageLine(message) {
    if (!message) return '';
    const speaker = message.is_user
        ? 'User'
        : (message.name ? `Assistant (${message.name})` : 'Assistant');
    return `${speaker}: ${message.mes || ''}`;
}

function getProgressionRuleInstruction() {
    const threshold = Number(get_settings('objective_auto_advance_threshold')) || 0;
    const thresholdPercent = Math.round(threshold * 100);
    const intentProgressionRule = get_settings('intent_progression_rule') || 'Remain on the current plot point unless the user clearly initiates movement toward the next one through their actions, goals, travel, or engagement with its people, place, or events.';
    const progressionRule = String(get_settings('progression_rule') || 'intent');

    if (progressionRule === 'objective_completion') {
        return `Active plot progression rule: Objective Completion. Set transition state only when the completed-objective ratio is at least ${thresholdPercent}% of the current plot point objectives. Clear user intent alone is not enough unless that intent also produces enough completed objectives to meet the threshold.`;
    }
    if (progressionRule === 'either') {
        return `Active plot progression rule: Either. Set transition state when either condition is met: (1) the user clearly shows intent to move beyond the current plot point, or (2) the completed-objective ratio is at least ${thresholdPercent}% of the current plot point objectives.`;
    }
    if (progressionRule === 'both') {
        return `Active plot progression rule: Both. Set transition state only when both conditions are met: (1) the user clearly shows intent to move beyond the current plot point, and (2) the completed-objective ratio is at least ${thresholdPercent}% of the current plot point objectives.`;
    }
    return `Active plot progression rule: Intent. ${intentProgressionRule} Set transition state only when the user clearly initiates movement beyond the current plot point. Objective completion threshold alone is not enough in this mode.`;
}

function applyTemplateTokens(template, replacements = {}) {
    let result = String(template || '');
    for (const [token, value] of Object.entries(replacements)) {
        result = result.replaceAll(token, value ?? '');
    }
    return result;
}

function buildDestiniaEvaluatorPrompt(evaluationContext = null) {
    const { timeline, current, next } = getCurrentPlotPoint();
    if (!current) return '';

    const contextForEvaluation = evaluationContext || getRecentEvaluationContext({ trace: true });
    const recentChatText = contextForEvaluation.recentChat.map(formatEvaluationMessageLine).join('\n');

    return applyTemplateTokens(get_settings('evaluator_prompt') || DEFAULT_EVALUATOR_PROMPT, {
        '{{storyTitle}}': timeline.storyTitle,
        '{{storyStyle}}': timeline.systemStyle,
        '{{currentTitle}}': current.title,
        '{{currentSummary}}': current.summary,
        '{{currentObjectives}}': JSON.stringify(current.objectives || []),
        '{{currentObjectiveCompletion}}': JSON.stringify(getCurrentObjectiveCompletionState()),
        '{{objectiveCompletionTriggerThreshold}}': String(Number(get_settings('objective_auto_advance_threshold')) || 0),
        '{{nextTitle}}': next?.title || 'None',
        '{{nextSummary}}': next?.summary || 'None',
        '{{recentChat}}': recentChatText,
        '{{objectiveCompletionGuidance}}': get_settings('objective_completion_guidance') || 'Only mark objective completion when the user meaningfully demonstrates progress relevant to the current plot point.',
        '{{progressionRuleInstruction}}': getProgressionRuleInstruction(),
    });
}

function buildTransitionCompletionPrompt(evaluationContext = null, transitionStateOverride = null) {
    const transitionState = transitionStateOverride || getTransitionState();
    const { timeline, source, destination } = transitionState;
    if (!source || !destination) return '';

    const contextForEvaluation = evaluationContext || getRecentEvaluationContext({ trace: true });
    const recentChatText = contextForEvaluation.recentChat.map(formatEvaluationMessageLine).join('\n');

    return applyTemplateTokens(DEFAULT_TRANSITION_COMPLETION_PROMPT, {
        '{{storyTitle}}': timeline.storyTitle,
        '{{storyStyle}}': timeline.systemStyle,
        '{{sourceTitle}}': source.title,
        '{{sourceSummary}}': source.summary,
        '{{destinationTitle}}': destination.title,
        '{{destinationSummary}}': destination.summary,
        '{{transitionGuidance}}': source.transitionGuidance || '',
        '{{recentChat}}': recentChatText,
    });
}

async function evaluateSeparatelyPerObjective(currentObjectives = [], evaluationContext = null) {
    const { timeline, current } = getCurrentPlotPoint();
    const contextForEvaluation = evaluationContext || getRecentEvaluationContext({ trace: true });
    const recentChatText = contextForEvaluation.recentChat.map(formatEvaluationMessageLine).join('\n');
    const guidance = get_settings('objective_completion_guidance') || 'Only mark objective completion when the conversation meaningfully demonstrates progress relevant to the current plot point.';
    const results = [];

    for (const objective of currentObjectives) {
        const objectiveText = typeof objective === 'string' ? objective : objective?.text || '';
        const prompt = [
            'Ignore previous instructions. Determine if this objective is completed based on the most recent messages.',
            guidance,
            'Return ONLY valid JSON with these keys:',
            '{',
            '  "completed": true,',
            '  "reason": "short explanation"',
            '}',
            `Story title: ${timeline.storyTitle || ''}`,
            `Story style: ${timeline.systemStyle || ''}`,
            `Current plot point title: ${current?.title || ''}`,
            `Current plot point summary: ${current?.summary || ''}`,
            `Objective: ${objectiveText}`,
            'Recent chat selected for evaluation:',
            recentChatText,
        ].join('\n');

        const response = String(await generateQuietPrompt(prompt, false, false) || '').trim();
        let completed = false;
        let reason = '';

        try {
            const parsed = JSON.parse(stripJsonCodeFences(response));
            completed = Boolean(parsed?.completed);
            reason = String(parsed?.reason || '');
        } catch {
            const lowered = response.toLowerCase();
            completed = lowered.includes('true') && !lowered.includes('false');
            reason = response;
        }

        results.push({ completed, reason });
    }

    return results;
}

function getLastGroupGenerationId() {
    const chat = Array.isArray(getContext().chat) ? getContext().chat : [];
    for (let index = chat.length - 1; index >= 0; index -= 1) {
        const message = chat[index];
        const generationId = message?.extra?.gen_id;
        if (message && !message.is_user && generationId !== undefined && generationId !== null) {
            return generationId;
        }
    }
    return null;
}

function getGroupEvaluationContext(options = {}) {
    const shouldTrace = options.trace !== false;
    const chat = Array.isArray(getContext().chat) ? getContext().chat : [];
    const generationId = getLastGroupGenerationId();

    if (generationId === null) {
        const emptyContext = {
            mode: getMessagesEvaluatedMode(),
            recentChat: [],
            recentUserChat: [],
            assistantBatch: [],
            targetMessage: null,
            generationId: null,
            turnStartIndex: null,
            firstBatchIndex: null,
            lastBatchIndex: null,
        };

        if (shouldTrace) {
            trace_debug('EvaluatorContext', {
                mode: emptyContext.mode,
                generationId: null,
                turnStartIndex: null,
                firstBatchIndex: null,
                lastBatchIndex: null,
                assistantBatchMessages: 0,
                userMessagesAvailable: 0,
                evaluatedMessages: 0,
                evaluatedCharacters: 0,
            });
        }

        return emptyContext;
    }

    const assistantBatchIndexes = [];
    for (let index = 0; index < chat.length; index += 1) {
        const message = chat[index];
        if (!message?.is_user && message?.extra?.gen_id === generationId) {
            assistantBatchIndexes.push(index);
        }
    }

    const assistantBatch = assistantBatchIndexes.map(index => chat[index]);
    const targetMessage = assistantBatch[assistantBatch.length - 1] || null;
    const firstBatchIndex = assistantBatchIndexes[0] ?? -1;
    const lastBatchIndex = assistantBatchIndexes[assistantBatchIndexes.length - 1] ?? -1;

    let turnStartIndex = 0;
    if (firstBatchIndex >= 0) {
        for (let index = firstBatchIndex - 1; index >= 0; index -= 1) {
            if (chat[index]?.is_user) {
                turnStartIndex = index;
                break;
            }
        }
    }

    const turnMessages = firstBatchIndex >= 0 && lastBatchIndex >= firstBatchIndex
        ? chat.slice(turnStartIndex, lastBatchIndex + 1)
        : assistantBatch;

    const recentUserChat = turnMessages.filter(message => message?.is_user);
    const mode = getMessagesEvaluatedMode();

    let recentChat = assistantBatch;
    if (mode === 'user') {
        recentChat = recentUserChat;
    } else if (mode === 'both') {
        recentChat = turnMessages;
    }

    const evaluationContext = {
        mode,
        recentChat,
        recentUserChat,
        assistantBatch,
        targetMessage,
        generationId,
        turnStartIndex,
        firstBatchIndex,
        lastBatchIndex,
    };

    if (shouldTrace) {
        trace_debug('EvaluatorContext', {
            mode,
            generationId,
            turnStartIndex,
            firstBatchIndex,
            lastBatchIndex,
            assistantBatchMessages: assistantBatch.length,
            userMessagesAvailable: recentUserChat.length,
            evaluatedMessages: recentChat.length,
            evaluatedCharacters: recentChat.reduce((sum, message) => sum + String(message?.mes || '').length, 0),
        });
    }

    return evaluationContext;
}

async function waitForEvaluationReady() {
    try {
        await waitUntilCondition(() => !streamingProcessor || streamingProcessor.isFinished, 15000, 100);
    } catch {
        debug('Evaluation readiness wait timed out while waiting for streaming to finish');
        return false;
    }
    return true;
}

function getEvaluationDelayMs() {
    const configured = Number(get_settings('evaluation_delay_seconds'));
    if (!Number.isFinite(configured)) return 2000;
    return Math.max(0, Math.round(configured * 1000));
}

function getEvaluationCooldownMs() {
    if (!get_settings('evaluation_cooldown_enabled')) return 0;
    const configured = Number(get_settings('evaluation_cooldown_seconds'));
    if (!Number.isFinite(configured)) return 0;
    return Math.max(0, Math.round(configured * 1000));
}

async function scheduleDestiniaEvaluation(targetMessage = null) {
    const sequence = ++scheduledEvaluationSequence;
    scheduledEvaluationTask = (async () => {
        const evaluationDelayMs = getEvaluationDelayMs();
        if (evaluationDelayMs > 0) {
            await delay(evaluationDelayMs);
            if (sequence !== scheduledEvaluationSequence) {
                debug('Skipping superseded scheduled Destinia evaluation during delay window');
                return null;
            }
        }

        const cooldownMs = getEvaluationCooldownMs();
        const waitMs = cooldownMs > 0 ? Math.max(0, (lastEvaluationStartedAt + cooldownMs) - Date.now()) : 0;
        if (waitMs > 0) {
            await delay(waitMs);
            if (sequence !== scheduledEvaluationSequence) {
                debug('Skipping superseded scheduled Destinia evaluation during cooldown window');
                return null;
            }
        }

        return evaluateDestiniaProgress(targetMessage);
    })();
    return scheduledEvaluationTask;
}

function getGroupEvaluationTargetMessage(evaluationContext = null) {
    const context = getContext();
    const chat = Array.isArray(context.chat) ? context.chat : [];
    if (!chat.length) return null;

    const mode = getMessagesEvaluatedMode();

    if (mode === 'user') {
        const pendingIndex = Number(pendingGroupUserEvaluationIndex);
        if (Number.isInteger(pendingIndex) && pendingIndex >= 0 && chat[pendingIndex]?.is_user) {
            return chat[pendingIndex];
        }
        for (let index = chat.length - 1; index >= 0; index -= 1) {
            if (chat[index]?.is_user) return chat[index];
        }
        return null;
    }

    if (evaluationContext?.targetMessage) {
        return evaluationContext.targetMessage;
    }

    return getGroupEvaluationContext({ trace: false }).targetMessage;
}

function buildEvaluationKey(targetMessage = null, evaluationContext = null) {
    const context = getContext();
    const chat = Array.isArray(context.chat) ? context.chat : [];
    const contextForEvaluation = evaluationContext || getRecentEvaluationContext({ trace: false });
    const evidenceText = contextForEvaluation.recentChat
        .map(message => `${message?.is_user ? 'U' : 'A'}:${message?.mes || ''}`)
        .join('\n');

    return JSON.stringify({
        mode: getMessagesEvaluatedMode(),
        progressionRule: get_settings('progression_rule'),
        objectiveThreshold: get_settings('objective_auto_advance_threshold'),
        objectiveMethod: get_settings('objective_evaluation_method'),
        timelineHash: getStringHash(get_settings('timeline_text') || ''),
        targetMessageId: targetMessage ? chat.indexOf(targetMessage) : -1,
        evidenceHash: getStringHash(evidenceText),
    });
}

async function evaluateDestiniaProgress(targetMessage = null) {
    return withEvaluatorExecutionLock(() => evaluateDestiniaProgressUnlocked(targetMessage));
}

async function evaluateDestiniaProgressUnlocked(targetMessage = null) {
    if (!chat_enabled() || !get_settings('dest_enabled')) return null;
    if (!(await waitForEvaluationReady())) return null;

    lastEvaluationStartedAt = Date.now();

    const evaluationContext = getRecentEvaluationContext({ trace: true });
    const resolvedTargetMessage = targetMessage || getGroupEvaluationTargetMessage(evaluationContext);
    const evaluationKey = buildEvaluationKey(resolvedTargetMessage, evaluationContext);

    if (evaluationKey === lastEvaluationKey) {
        debug('Skipping duplicate Destinia evaluation for unchanged evidence');
        return null;
    }

    if (shouldSuppressFailedEvaluationRetry(evaluationKey)) {
        debug('Skipping recently failed Destinia evaluation for unchanged evidence', {
            retryCooldownMs: getFailedEvaluationRetryCooldownMs(),
            lastFailedEvaluationAt,
        });
        return null;
    }

    const transitionState = getTransitionState();
    const prompt = transitionState.transitionActive
        ? buildTransitionCompletionPrompt(evaluationContext, transitionState)
        : buildDestiniaEvaluatorPrompt(evaluationContext);

    if (!prompt) return null;

    activeEvaluationKey = evaluationKey;

    const evaluatorProfileId = getEvaluatorConnectionProfileId();
    const evaluatorProfileRecord = getConnectionProfileRecordById(evaluatorProfileId);
    const evaluatorPreset = await get_evaluator_preset(evaluatorProfileId);

    try {
        active_diagnostic_loading_index = resolvedTargetMessage ? getContext().chat.indexOf(resolvedTargetMessage) : null;
        active_diagnostic_loading_started_at = Date.now();
        update_all_message_visuals();

        trace_debug('EvaluateDestiniaProgress:start', {
            targetIsUser: Boolean(resolvedTargetMessage?.is_user),
            targetName: resolvedTargetMessage?.name || '',
            evaluatorProfileId,
            evaluatorProfileName: evaluatorProfileRecord?.name || '',
            evaluatorProfileApi: evaluatorProfileRecord?.api || '',
            evaluatorProfilePreset: evaluatorProfileRecord?.preset || '',
            evaluatorPreset,
            usingConnectionManagerRequest: Boolean(evaluatorProfileId && evaluatorProfileRecord && getConnectionManagerRequestService()?.sendRequest),
            availableConnectionProfiles: getConnectionManagerProfiles().map(item => ({
                id: item.id,
                name: item.name,
                api: item.api || '',
                preset: item.preset || '',
            })),
            promptLength: prompt.length,
            promptPreview: prompt.slice(0, 300),
            transitionActive: transitionState.transitionActive,
        });

        const response = await sendEvaluatorRequest(prompt, evaluatorProfileId);

        let parsed;
        try {
            parsed = JSON.parse(stripJsonCodeFences(String(response || '')));
        } catch (parseError) {
            trace_debug('EvaluateDestiniaProgress:parseFailure', {
                transitionActive: transitionState.transitionActive,
                responseType: typeof response,
                responsePreview: String(response || '').slice(0, 1000),
                strippedResponsePreview: stripJsonCodeFences(String(response || '')).slice(0, 1000),
                parseErrorName: parseError?.name || '',
                parseErrorMessage: parseError?.message || String(parseError || ''),
            });
            throw parseError;
        }

        if (transitionState.transitionActive) {
    const completion = String(parsed?.decision || '').trim().toLowerCase();
    const transitionDecision = completion === 'complete' ? 'complete' : 'incomplete';
    const transitionReason = String(parsed?.reason || '').trim();
    const transitionConfidence = Number(parsed?.confidence);
    const sourceTitle = transitionState.source?.title || '';
    const destinationTitle = transitionState.destination?.title || '';

    trace_debug('EvaluateDestiniaProgress:transitionCompletionResult', {
        decision: transitionDecision,
        sourceId: transitionState.timeline.transitionFrom,
        destinationId: transitionState.timeline.transitionTo,
        sourceTitle,
        destinationTitle,
        reason: transitionReason,
        confidence: Number.isFinite(transitionConfidence) ? transitionConfidence : null,
    });

    const diagnostic = {
        current_plot_title: sourceTitle,
        objective_completion: [],
        objectives: [],
        objective_reasons: [],
        did_advance: false,
        transition: {
            // This is a per-message diagnostic snapshot, not the live Timeline JSON state.
            was_active: true,
            decision: transitionDecision,
            completed: transitionDecision === 'complete',
            source_id: transitionState.timeline.transitionFrom || '',
            destination_id: transitionState.timeline.transitionTo || '',
            source_title: sourceTitle,
            destination_title: destinationTitle,
            source_summary: transitionState.source?.summary || '',
            destination_summary: transitionState.destination?.summary || '',
            transition_guidance: transitionState.source?.transitionGuidance || '',
            reason: transitionReason || 'No transition-specific reason recorded.',
            confidence: Number.isFinite(transitionConfidence) ? transitionConfidence : null,
        },
    };

    if (transitionDecision === 'complete' && transitionState.destination) {
        const timeline = getDestiniaTimeline();

        trace_debug('TransitionStateWriteback:start', {
            previousCurrentPlotPoint: timeline.currentPlotPoint,
            previousTransitionFrom: timeline.transitionFrom,
            previousTransitionTo: timeline.transitionTo,
            destinationId: transitionState.destination.id,
        });

        timeline.currentPlotPoint = transitionState.destination.id;
        timeline.transitionFrom = null;
        timeline.transitionTo = null;

        const nextTimelineText = JSON.stringify(timeline, null, 2);
commitTimelineText(nextTimelineText);

        trace_debug('TransitionStateWriteback:complete', {
            currentPlotPoint: timeline.currentPlotPoint,
            transitionFrom: timeline.transitionFrom,
            transitionTo: timeline.transitionTo,
        });

        diagnostic.did_advance = true;
        diagnostic.current_plot_title = destinationTitle || sourceTitle;
    }

    if (resolvedTargetMessage) {
        const targetIndex = getContext().chat.indexOf(resolvedTargetMessage);
        set_data(resolvedTargetMessage, 'current_plot_title', diagnostic.current_plot_title || '');
        set_data(resolvedTargetMessage, 'diagnostic', diagnostic);
        finishing_diagnostic_index = targetIndex >= 0 ? targetIndex : null;

        trace_debug('EvaluateDestiniaProgress:transitionAttached', {
            targetIsUser: Boolean(resolvedTargetMessage?.is_user),
            targetName: resolvedTargetMessage?.name || '',
            targetIndex,
            transition: diagnostic.transition,
            didAdvance: diagnostic.did_advance,
        });
    }

    markEvaluationSucceeded(evaluationKey);
    render_status_panel();
    return parsed;
}

        const rawDecision = String(parsed?.decision || '').trim().toLowerCase();
        const decision = rawDecision === 'advance' || rawDecision === 'progress' ? 'progress' : 'stagnate';
        const { current, points, currentIndex } = getCurrentPlotPoint();

        trace_debug('EvaluateDestiniaProgress:finishTriggerResult', {
            decision,
            rawDecision,
            currentPlotPointId: current?.id || '',
            currentPlotPointTitle: current?.title || '',
        });

        const currentObjectives = Array.isArray(current?.objectives) ? current.objectives : [];
        const objectiveEvaluationMethod = get_settings('objective_evaluation_method') || 'integrated';
        const integratedObjectiveCompletion = Array.isArray(parsed?.objective_completion) ? parsed.objective_completion.map(Boolean) : [];
        const integratedObjectiveReasons = Array.isArray(parsed?.objective_reasons) ? parsed.objective_reasons.map(item => String(item || '')) : [];

        const objectiveResults = objectiveEvaluationMethod === 'per_objective'
            ? await evaluateSeparatelyPerObjective(currentObjectives, evaluationContext)
            : currentObjectives.map((objective, index) => ({
                completed: Boolean(integratedObjectiveCompletion[index] ?? (typeof objective?.completed === 'boolean' ? objective.completed : false)),
                reason: integratedObjectiveReasons[index] || '',
            }));

        const objectiveCompletion = currentObjectives.map((objective, index) => {
            const persisted = typeof objective?.completed === 'boolean' ? objective.completed : false;
            return Boolean(objectiveResults[index]?.completed ?? persisted);
        });

        persistObjectiveCompletionToTimeline(objectiveCompletion);

        const diagnostic = {
            current_plot_title: current?.title || '',
            objective_completion: objectiveCompletion,
            objectives: currentObjectives.map((objective) => typeof objective === 'string' ? objective : objective?.text || ''),
            objective_reasons: objectiveResults.map((result) => String(result?.reason || '')),
            did_advance: false,
        };

        if (decision === 'progress' && currentIndex < points.length - 1) {
            const destination = points[currentIndex + 1];
            const timeline = getDestiniaTimeline();

            trace_debug('TransitionStateWriteback:start', {
                previousCurrentPlotPoint: timeline.currentPlotPoint,
                previousTransitionFrom: timeline.transitionFrom,
                previousTransitionTo: timeline.transitionTo,
                sourceId: current?.id || null,
                destinationId: destination?.id || null,
            });

            timeline.transitionFrom = current?.id || null;
            timeline.transitionTo = destination?.id || null;

            const nextTimelineText = JSON.stringify(timeline, null, 2);
commitTimelineText(nextTimelineText);

            trace_debug('TransitionStateWriteback:complete', {
                currentPlotPoint: timeline.currentPlotPoint,
                transitionFrom: timeline.transitionFrom,
                transitionTo: timeline.transitionTo,
            });

            diagnostic.did_advance = true;
        }

        if (resolvedTargetMessage) {
            const targetIndex = getContext().chat.indexOf(resolvedTargetMessage);
            set_data(resolvedTargetMessage, 'current_plot_title', current?.title || '');
            set_data(resolvedTargetMessage, 'diagnostic', diagnostic);
            finishing_diagnostic_index = targetIndex >= 0 ? targetIndex : null;

            trace_debug('EvaluateDestiniaProgress:attached', {
                targetIsUser: Boolean(resolvedTargetMessage?.is_user),
                targetName: resolvedTargetMessage?.name || '',
                objectiveCompletion,
            });
        }

        markEvaluationSucceeded(evaluationKey);
        render_status_panel();
        return parsed;
    } catch (error) {
        markEvaluationFailed(evaluationKey);

        trace_debug('EvaluateDestiniaProgress:error', {
            transitionActive: transitionState.transitionActive,
            targetIsUser: Boolean(resolvedTargetMessage?.is_user),
            targetName: resolvedTargetMessage?.name || '',
            evaluatorProfileId,
            evaluatorProfileName: evaluatorProfileRecord?.name || '',
            evaluatorPreset,
            activeEvaluationKey,
            errorName: error?.name || '',
            errorMessage: error?.message || String(error || ''),
            errorStack: error?.stack || '',
        });

        debug('Destinia evaluator failed', {
            transitionActive: transitionState.transitionActive,
            errorName: error?.name || '',
            errorMessage: error?.message || String(error || ''),
            errorStack: error?.stack || '',
        });

        return null;
    } finally {
        active_diagnostic_loading_index = null;
        active_diagnostic_loading_started_at = 0;
        pendingGroupUserEvaluationIndex = null;
        update_all_message_visuals();

        setTimeout(() => {
            finishing_diagnostic_index = null;
            update_all_message_visuals();
        }, 1500);

        trace_debug('EvaluateDestiniaProgress:cleanup', {
            globalProfileSwitchingUsed: false,
            evaluatorProfileId,
            evaluatorProfileName: evaluatorProfileRecord?.name || '',
        });

        activeEvaluationKey = '';
    }
}

function get_extension_directory() {
    // get the directory of the extension
    let index_path = new URL(import.meta.url).pathname
    return index_path.substring(0, index_path.lastIndexOf('/'))  // remove the /index.js from the path
}
function clean_string_for_html(text) {
    return String(text ?? '').replace(/["&'<>]/g, function(match) {
        switch (match) {
            case '"': return "&quot;";
            case "&": return "&amp;";
            case "'": return "&apos;";
            case "<": return "&lt;";
            case ">": return "&gt;";
        }
    })
}
function stripJsonCodeFences(text) {
    const raw = String(text || '').trim();
    const fencedMatch = raw.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    if (fencedMatch) {
        return String(fencedMatch[1] || '').trim();
    }
    return raw;
}
function hasBalancedTemplateDelimiters(value) {
    const text = String(value || '');
    const opens = (text.match(/\{\{/g) || []).length;
    const closes = (text.match(/\}\}/g) || []).length;
    return opens === closes;
}
function validateConfiguredField(fieldId) {
    const config = TEMPLATE_VALIDATION_RULES[fieldId];
    const element = document.querySelector(`.${settings_content_class} #${fieldId}`);
    if (!config || !element) return null;

    const value = String(element.value || '');
    if (config.type === 'json') {
        const result = getValidatedTimelineText(value);
        return result.valid ? null : `${config.label}: ${result.issues.join('; ')}`;
    }

    if (!hasBalancedTemplateDelimiters(value)) {
        return `${config.label} has unmatched template delimiters.`;
    }

    const missingTokens = (config.requiredTokens || []).filter(token => !value.includes(token));
    if (missingTokens.length) {
        return `${config.label} is missing required placeholders: ${missingTokens.join(', ')}`;
    }

    return null;
}
function updateFieldValidationIndicators() {
    for (const fieldId of Object.keys(TEMPLATE_VALIDATION_RULES)) {
        const element = document.querySelector(`.${settings_content_class} #${fieldId}`);
        if (!element) continue;

        let icon = element.parentElement?.querySelector(`.aspect-destinia-warning-icon[data-validation-for="${fieldId}"]`);
        if (!icon) {
            const label = element.parentElement?.querySelector('.aspect-destinia-label');
            if (!label) continue;
            icon = document.createElement('span');
            icon.className = 'aspect-destinia-warning-icon';
            icon.dataset.validationFor = fieldId;
            icon.textContent = '⚠️';
            icon.hidden = true;
            label.insertAdjacentElement('afterend', icon);
        }

        const message = validateConfiguredField(fieldId);
        icon.hidden = !message;
        icon.setAttribute('title', message || '');
        icon.setAttribute('aria-label', message || '');
    }
}
function format_percent(value) {
    return `${Math.round((Number(value) || 0) * 100)}%`;
}
function update_slider_displays() {
    const percentPairs = [
        ['#strictness', '#strictness_value'],
        ['#pacing_bias', '#pacing_bias_value'],
        ['#objective_auto_advance_threshold', '#objective_auto_advance_threshold_value'],
    ];
    for (const [inputSelector, valueSelector] of percentPairs) {
        const input = document.querySelector(`.${settings_content_class} ${inputSelector}`);
        const output = document.querySelector(`.${settings_content_class} ${valueSelector}`);
        if (input && output) {
            output.textContent = format_percent(input.value);
        }
    }

    const secondsPairs = [
        ['#evaluation_cooldown_seconds', '#evaluation_cooldown_seconds_value'],
        ['#evaluation_delay_seconds', '#evaluation_delay_seconds_value'],
    ];
    for (const [inputSelector, valueSelector] of secondsPairs) {
        const input = document.querySelector(`.${settings_content_class} ${inputSelector}`);
        const output = document.querySelector(`.${settings_content_class} ${valueSelector}`);
        if (input && output) {
            output.textContent = `${Number(input.value).toFixed(1)}s`;
        }
    }
}
function bindTextAreaLauncher(selector, key, title, description = '') {
    const element = $(`.${settings_content_class} ${selector}`);
    if (!element.length) return;

    element.off('dblclick.aspectDestiniaLauncher').on('dblclick.aspectDestiniaLauncher', async () => {
        await get_user_setting_text_input(key, title, description);
    });
}
const FIELD_DEFAULTS = {
    timeline_text: () => JSON.stringify(DEFAULT_TIMELINE_TEMPLATE, null, 2),
    guidance_intro: () => default_settings.guidance_intro,
    guidance_principles: () => default_settings.guidance_principles,
    current_plot_point_template: () => default_settings.current_plot_point_template,
    next_plot_point_template: () => default_settings.next_plot_point_template,
    transition_template: () => default_settings.transition_template,
    objective_guidance_template: () => default_settings.objective_guidance_template,
    intent_progression_rule: () => default_settings.intent_progression_rule,
    progression_instruction: () => default_settings.progression_instruction,
    pacing_instruction: () => default_settings.pacing_instruction,
    objective_completion_guidance: () => default_settings.objective_completion_guidance,
    foreshadowing_template: () => default_settings.foreshadowing_template,
    timeline_deviation_instruction: () => default_settings.timeline_deviation_instruction,
    auto_resolve_deviation_instruction: () => default_settings.auto_resolve_deviation_instruction,
    detach_instruction: () => default_settings.detach_instruction,
    guidance_outro: () => default_settings.guidance_outro,
    evaluator_prompt: () => default_settings.evaluator_prompt,
    strictness: () => default_settings.strictness,
    pacing_bias: () => default_settings.pacing_bias,
    objective_auto_advance_threshold: () => default_settings.objective_auto_advance_threshold,
    evaluation_cooldown_seconds: () => default_settings.evaluation_cooldown_seconds,
    evaluation_delay_seconds: () => default_settings.evaluation_delay_seconds,
};
function resetFieldToDefault(fieldId) {
    const factory = FIELD_DEFAULTS[fieldId];
    if (!factory) return;
    const element = document.querySelector(`.${settings_content_class} #${fieldId}`);
    if (!element) return;

    const value = factory();
    if (fieldId === 'timeline_text') {
        const selectedPresetId = String(get_settings('selected_timeline_preset') || '').trim();
        if (selectedPresetId === 'default_timeline_preset') {
            const presets = get_settings('timeline_presets', true) || {};
            if (presets.default_timeline_preset) {
                presets.default_timeline_preset.timelineText = String(value ?? '');
                set_settings('timeline_presets', presets);
            }
        }
    }

    if (element.type === 'checkbox') {
        element.checked = Boolean(value);
    } else {
        element.value = String(value ?? '');
    }

    $(element).trigger(element.tagName === 'TEXTAREA' ? 'input' : 'change');
}
function resetTimelineObjectives() {
    const element = document.querySelector(`.${settings_content_class} #timeline_text`);
    if (!element) return;

    let parsed;
    try {
        parsed = JSON.parse(String(element.value || ''));
    } catch {
        toast('Timeline JSON must be valid before objectives can be reset.', 'warning');
        return;
    }

    if (!Array.isArray(parsed.plotPoints)) {
        toast('Timeline JSON must include plotPoints[] before objectives can be reset.', 'warning');
        return;
    }

    parsed.plotPoints = parsed.plotPoints.map((plotPoint) => {
        if (!plotPoint || typeof plotPoint !== 'object') return plotPoint;
        const objectives = Array.isArray(plotPoint.objectives) ? plotPoint.objectives : [];
        return {
            ...plotPoint,
            objectives: objectives.map((objective) => {
                const normalized = normalizeObjectiveItem(objective);
                normalized.completed = false;
                return normalized;
            }),
        };
    });

    element.value = JSON.stringify(parsed, null, 2);
    $(element).trigger('input');
}
function repairTimelineJson() {
    const element = document.querySelector(`.${settings_content_class} #timeline_text`);
    if (!element) return;

    try {
        const parsed = JSON.parse(String(element.value || ''));
        const repaired = normalizeDestiniaTimeline(parsed);
        element.value = JSON.stringify(repaired, null, 2);
        $(element).trigger('input');
        toast('Timeline JSON repaired.', 'success');
    } catch {
        const repaired = JSON.stringify(structuredClone(DEFAULT_TIMELINE_TEMPLATE), null, 2);
        element.value = repaired;
        $(element).trigger('input');
        toast('Timeline JSON was invalid and has been replaced with a repaired default template.', 'warning');
    }
}
function renderInfoTip(key, label = 'More information') {
    const helpText = LABEL_HELP[key];
    if (!helpText) return '';

    return `<span class="aspect-destinia-info-tooltip" data-tooltip-key="${clean_string_for_html(key)}"><button
                type="button"
                class="aspect-destinia-info-trigger"
                aria-label="${clean_string_for_html(label)}"
                aria-expanded="false"
            ><span class="aspect-destinia-info-trigger-text" aria-hidden="true">i</span></button><span class="aspect-destinia-info-bubble" role="tooltip">${clean_string_for_html(helpText)}</span></span>`;
}
function appendInfoTip(target, key, label) {
    if (!target || !LABEL_HELP[key]) return;
    if (target.parentElement?.querySelector(`.aspect-destinia-info-tooltip[data-tooltip-key="${key}"]`)) return;
    target.insertAdjacentHTML('beforeend', renderInfoTip(key, label));
}
function addInfoTipsToSettings() {
    const root = document.getElementById(ROOT_ID);
    if (!root) return;

    appendInfoTip(root.querySelector('label[for="dest_enabled"].aspect-destinia-checkbox-label-text'), 'extension_enabled', 'Explain Extension Enabled');
    const profileLabel = Array.from(root.querySelectorAll('.aspect-destinia-label')).find((element) => element.textContent.trim() === 'Profile');
    appendInfoTip(profileLabel, 'profile', 'Explain Profile');
    const currentChatLabel = Array.from(root.querySelectorAll('.aspect-destinia-label')).find((element) => element.textContent.trim() === 'Current Chat');
    appendInfoTip(currentChatLabel, 'current_chat', 'Explain Current Chat');
    const evaluatorConnectionLabel = Array.from(root.querySelectorAll('.aspect-destinia-label')).find((element) => element.textContent.trim() === 'Evaluator Connection Profile');
    appendInfoTip(evaluatorConnectionLabel, 'evaluator_connection_profile', 'Explain Evaluator Connection Profile');
    const evaluatorPresetLabel = Array.from(root.querySelectorAll('.aspect-destinia-label')).find((element) => element.textContent.trim() === 'Evaluator Chat Completion Preset');
    appendInfoTip(evaluatorPresetLabel, 'evaluator_chat_completion_preset', 'Explain Evaluator Chat Completion Preset');
    const recentMessagesLabel = Array.from(root.querySelectorAll('.aspect-destinia-label')).find((element) => element.textContent.trim() === 'Recent Messages to Evaluate');
    appendInfoTip(recentMessagesLabel, 'recent_messages_to_evaluate', 'Explain Recent Messages to Evaluate');
    const messagesEvaluatedLabel = Array.from(root.querySelectorAll('.aspect-destinia-label')).find((element) => element.textContent.trim() === 'Messages Evaluated');
    appendInfoTip(messagesEvaluatedLabel, 'messages_evaluated', 'Explain Messages Evaluated');
    const evaluationCooldownEnabledLabel = Array.from(root.querySelectorAll('.aspect-destinia-label')).find((element) => element.textContent.trim() === 'Evaluation Cooldown');
    appendInfoTip(evaluationCooldownEnabledLabel, 'evaluation_cooldown_enabled', 'Explain Evaluation Cooldown');
    const evaluationCooldownSecondsLabel = Array.from(root.querySelectorAll('.aspect-destinia-label')).find((element) => element.textContent.trim() === 'Cooldown Seconds');
    appendInfoTip(evaluationCooldownSecondsLabel, 'evaluation_cooldown_seconds', 'Explain Cooldown Seconds');
    const evaluationDelaySecondsLabel = Array.from(root.querySelectorAll('.aspect-destinia-label')).find((element) => element.textContent.trim() === 'Post-Response Delay');
    appendInfoTip(evaluationDelaySecondsLabel, 'evaluation_delay_seconds', 'Explain Post-Response Delay');
    const timelineTitle = Array.from(root.querySelectorAll('.aspect-destinia-section-title')).find((element) => element.textContent.trim() === 'Timeline');
    appendInfoTip(timelineTitle, 'timeline', 'Explain Timeline');
    const timelinePresetLabel = Array.from(root.querySelectorAll('.aspect-destinia-label')).find((element) => element.textContent.trim() === 'Timeline Preset');
    appendInfoTip(timelinePresetLabel, 'timeline_preset', 'Explain Timeline Preset');
    const timelineDeviationLabel = Array.from(root.querySelectorAll('.aspect-destinia-label')).find((element) => element.textContent.trim() === 'Timeline Deviation');
    appendInfoTip(timelineDeviationLabel, 'timeline_deviation', 'Explain Timeline Deviation');
    const autoResolveDeviationLabel = Array.from(root.querySelectorAll('.aspect-destinia-label')).find((element) => element.textContent.trim() === 'Timeline Deviation Auto-Resolve');
    appendInfoTip(autoResolveDeviationLabel, 'timeline_deviation_auto_resolve', 'Explain Timeline Deviation Auto-Resolve');
    const detachLabel = Array.from(root.querySelectorAll('.aspect-destinia-label')).find((element) => element.textContent.trim() === 'Detach');
    appendInfoTip(detachLabel, 'detach', 'Explain Detach');
    const detachInstructionLabel = Array.from(root.querySelectorAll('.aspect-destinia-label')).find((element) => element.textContent.trim() === 'Detach Instruction');
    appendInfoTip(detachInstructionLabel, 'detach_instruction', 'Explain Detach Instruction');
    const progressionRuleLabel = Array.from(root.querySelectorAll('.aspect-destinia-label')).find((element) => element.textContent.trim() === 'Plot Progression Rules');
    appendInfoTip(progressionRuleLabel, 'progression_rule', 'Explain Plot Progression Rules');
    const autoAdvanceThresholdLabel = Array.from(root.querySelectorAll('.aspect-destinia-label')).find((element) => element.textContent.trim() === 'Objective Completion Trigger Threshold');
    appendInfoTip(autoAdvanceThresholdLabel, 'objective_auto_advance_threshold', 'Explain Objective Completion Trigger Threshold');
    const objectiveEvaluationMethodLabel = Array.from(root.querySelectorAll('.aspect-destinia-label')).find((element) => element.textContent.trim() === 'Objective Evaluation Method');
    appendInfoTip(objectiveEvaluationMethodLabel, 'objective_evaluation_method', 'Explain Objective Evaluation Method');
    const strictnessLabel = Array.from(root.querySelectorAll('.aspect-destinia-label')).find((element) => element.textContent.trim() === 'Plot Alignment Strictness');
    appendInfoTip(strictnessLabel, 'plot_alignment_strictness', 'Explain Plot Alignment Strictness');
    const pacingBiasLabel = Array.from(root.querySelectorAll('.aspect-destinia-label')).find((element) => element.textContent.trim() === 'Plot Progression Aggressiveness');
    appendInfoTip(pacingBiasLabel, 'plot_progression_aggressiveness', 'Explain Plot Progression Aggressiveness');
    const foreshadowingLabel = Array.from(root.querySelectorAll('.aspect-destinia-label')).find((element) => element.textContent.trim() === 'Plot Foreshadowing');
    appendInfoTip(foreshadowingLabel, 'plot_foreshadowing', 'Explain Plot Foreshadowing');
    const guidanceFieldsTitle = Array.from(root.querySelectorAll('.aspect-destinia-section-title')).find((element) => element.textContent.trim() === 'Injected Guidance Fields');
    appendInfoTip(guidanceFieldsTitle, 'injected_guidance_fields', 'Explain Injected Guidance Fields');

    const fieldTooltipMap = {
        guidance_intro: 'injection_intro',
        guidance_principles: 'guidance_principles',
        current_plot_point_template: 'current_plot_point_template',
        next_plot_point_template: 'next_plot_point_template',
        transition_template: 'transition_template',
        objective_guidance_template: 'objective_guidance_template',
        intent_progression_rule: 'intent_progression_rule',
        progression_instruction: 'progression_instruction',
        pacing_instruction: 'pacing_instruction',
        objective_completion_guidance: 'objective_completion_guidance',
        foreshadowing_template: 'foreshadowing_template',
        timeline_deviation_instruction: 'timeline_deviation_instruction',
        auto_resolve_deviation_instruction: 'auto_resolve_deviation_instruction',
        guidance_outro: 'guidance_outro',
        evaluator_prompt: 'evaluator_prompt',
    };
    for (const [fieldId, helpKey] of Object.entries(fieldTooltipMap)) {
        const label = root.querySelector(`[for="${fieldId}"].aspect-destinia-label`) || root.querySelector(`#${fieldId}`)?.parentElement?.querySelector('.aspect-destinia-label');
        appendInfoTip(label, helpKey, `Explain ${label?.textContent?.trim() || fieldId}`);
    }

    const guidanceSettingsTitle = Array.from(root.querySelectorAll('.aspect-destinia-section-title')).find((element) => element.textContent.trim() === 'Guidance Injection Settings');
    appendInfoTip(guidanceSettingsTitle, 'guidance_placement', 'Explain Guidance Injection Settings');
    const guidancePlacementLabel = Array.from(root.querySelectorAll('.aspect-destinia-label')).find((element) => element.textContent.trim() === 'Guidance Placement');
    appendInfoTip(guidancePlacementLabel, 'guidance_placement', 'Explain Guidance Placement');
    const guidancePlacementOptions = Array.from(root.querySelectorAll('input[name="guidance_position"]')).map((input) => input.parentElement).filter(Boolean);
    appendInfoTip(guidancePlacementOptions.find((element) => element.textContent.includes('Before Main Prompt')), 'guidance_placement', 'Explain Before Main Prompt');
    appendInfoTip(guidancePlacementOptions.find((element) => element.textContent.includes('After Main Prompt')), 'guidance_placement', 'Explain After Main Prompt');
    appendInfoTip(guidancePlacementOptions.find((element) => element.textContent.includes('In Chat at Depth')), 'guidance_placement', 'Explain In Chat at Depth');
    const guidanceScanLabel = Array.from(root.querySelectorAll('.checkbox_label > span')).find((element) => element.textContent.trim() === 'Include in World Info Scanning');
    appendInfoTip(guidanceScanLabel, 'include_in_world_info_scanning', 'Explain Include in World Info Scanning');
    const miscTitle = Array.from(root.querySelectorAll('.aspect-destinia-section-title')).find((element) => element.textContent.trim() === 'Misc.');
    appendInfoTip(miscTitle, 'debug_mode', 'Explain Miscellaneous Settings');
    const statusTitle = Array.from(root.querySelectorAll('.aspect-destinia-section-title')).find((element) => element.textContent.trim() === 'Status');
    appendInfoTip(statusTitle, 'display_message_state', 'Explain Status');
    const displayMemoriesLabel = Array.from(root.querySelectorAll('.checkbox_label > span')).find((element) => element.textContent.trim() === 'Diagnostic Messages');
    appendInfoTip(displayMemoriesLabel, 'display_message_state', 'Explain Diagnostic Messages');
    const notifyOnSwitchLabel = Array.from(root.querySelectorAll('.checkbox_label > span')).find((element) => element.textContent.trim() === 'Notify on Switch');
    appendInfoTip(notifyOnSwitchLabel, 'notify_on_switch', 'Explain Notify on Switch');
    const debugModeLabel = Array.from(root.querySelectorAll('.checkbox_label > span')).find((element) => element.textContent.trim() === 'Debug Mode');
    appendInfoTip(debugModeLabel, 'debug_mode', 'Explain Debug Mode');
}
function setupInfoTooltips() {
    const root = document.getElementById(ROOT_ID);
    if (!root || root.dataset.infoTooltipsBound === 'true') return;

    const viewportPadding = 12;
    const tooltipLayerId = `${ROOT_ID}_tooltip_layer`;
    let tooltipLayer = document.getElementById(tooltipLayerId);
    if (!tooltipLayer) {
        tooltipLayer = document.createElement('div');
        tooltipLayer.id = tooltipLayerId;
        tooltipLayer.className = 'aspect-destinia-tooltip-layer';
        document.body.appendChild(tooltipLayer);
    }

    root.querySelectorAll('.aspect-destinia-info-tooltip').forEach((tooltip, index) => {
        const bubble = tooltip.querySelector('.aspect-destinia-info-bubble');
        if (!bubble) return;
        const bubbleId = bubble.id || `${ROOT_ID}_tooltip_${index + 1}`;
        bubble.id = bubbleId;
        tooltip.dataset.tooltipBubbleId = bubbleId;
        if (bubble.parentElement !== tooltipLayer) {
            tooltipLayer.appendChild(bubble);
        }
    });

    const getTooltipParts = (tooltip) => {
        if (!tooltip) return { trigger: null, bubble: null };
        const trigger = tooltip.querySelector('.aspect-destinia-info-trigger');
        const bubbleId = tooltip.dataset.tooltipBubbleId || '';
        const bubble = bubbleId ? document.getElementById(bubbleId) : null;
        return { trigger, bubble };
    };

    const clearTooltipPosition = (bubble) => {
        if (!bubble) return;
        bubble.classList.remove('is-active', 'is-measuring', 'is-positioned');
        bubble.style.removeProperty('--aspect-destinia-tooltip-left');
        bubble.style.removeProperty('--aspect-destinia-tooltip-top');
    };

    const updateTooltipPosition = (tooltip) => {
        if (!tooltip) return;
        const { trigger, bubble } = getTooltipParts(tooltip);
        if (!trigger || !bubble) return;

        bubble.classList.remove('is-positioned');
        bubble.classList.add('is-measuring');
        bubble.style.removeProperty('--aspect-destinia-tooltip-left');
        bubble.style.removeProperty('--aspect-destinia-tooltip-top');

        const triggerRect = trigger.getBoundingClientRect();
        const bubbleRect = bubble.getBoundingClientRect();
        const maxLeft = Math.max(viewportPadding, window.innerWidth - viewportPadding - bubbleRect.width);
        const desiredLeft = triggerRect.right - bubbleRect.width;
        const left = Math.min(Math.max(viewportPadding, desiredLeft), maxLeft);
        const top = Math.min(
            triggerRect.bottom + 8,
            Math.max(viewportPadding, window.innerHeight - viewportPadding - bubbleRect.height)
        );

        bubble.style.setProperty('--aspect-destinia-tooltip-left', `${Math.round(left)}px`);
        bubble.style.setProperty('--aspect-destinia-tooltip-top', `${Math.round(top)}px`);
        bubble.classList.remove('is-measuring');
        bubble.classList.add('is-positioned');
    };

    const hideTooltip = (tooltip) => {
        if (!tooltip) return;
        tooltip.classList.remove('is-open');
        tooltip.dataset.justClosed = 'true';
        setTimeout(() => {
            if (tooltip.dataset.justClosed === 'true') {
                delete tooltip.dataset.justClosed;
            }
        }, 0);
        const { trigger, bubble } = getTooltipParts(tooltip);
        if (trigger) {
            trigger.setAttribute('aria-expanded', 'false');
        }
        clearTooltipPosition(bubble);
    };

    const showTooltip = (tooltip, { pinned = false } = {}) => {
        if (!tooltip || tooltip.dataset.justClosed === 'true') return;
        const { trigger, bubble } = getTooltipParts(tooltip);
        if (!trigger || !bubble) return;

        bubble.classList.add('is-active');
        tooltip.classList.toggle('is-open', pinned);
        trigger.setAttribute('aria-expanded', pinned ? 'true' : 'false');
        updateTooltipPosition(tooltip);
    };

    const closeOpenTooltips = (except = null) => {
        root.querySelectorAll('.aspect-destinia-info-tooltip').forEach((tooltip) => {
            if (tooltip === except) return;
            hideTooltip(tooltip);
        });
    };

    root.addEventListener('pointerdown', (event) => {
        const trigger = event.target.closest('.aspect-destinia-info-trigger');
        if (!trigger) return;
        event.preventDefault();
        event.stopPropagation();
    }, true);

    root.addEventListener('mouseenter', (event) => {
        const tooltip = event.target.closest('.aspect-destinia-info-tooltip');
        if (!tooltip || tooltip.classList.contains('is-open')) return;
        closeOpenTooltips(tooltip);
        showTooltip(tooltip);
    }, true);

    root.addEventListener('mouseleave', (event) => {
        const tooltip = event.target.closest('.aspect-destinia-info-tooltip');
        if (!tooltip || tooltip.classList.contains('is-open')) return;
        hideTooltip(tooltip);
    }, true);

    root.addEventListener('focusin', (event) => {
        const tooltip = event.target.closest('.aspect-destinia-info-tooltip');
        if (!tooltip || tooltip.classList.contains('is-open')) return;
        closeOpenTooltips(tooltip);
        showTooltip(tooltip);
    });

    root.addEventListener('focusout', (event) => {
        const tooltip = event.target.closest('.aspect-destinia-info-tooltip');
        if (!tooltip || tooltip.classList.contains('is-open')) return;
        const nextTarget = event.relatedTarget;
        if (nextTarget && tooltip.contains(nextTarget)) return;
        hideTooltip(tooltip);
    });

    root.addEventListener('click', (event) => {
        const trigger = event.target.closest('.aspect-destinia-info-trigger');
        if (!trigger) return;

        const tooltip = trigger.closest('.aspect-destinia-info-tooltip');
        if (!tooltip) return;

        event.preventDefault();
        event.stopPropagation();

        trigger.focus({ preventScroll: true });

        const willOpen = !tooltip.classList.contains('is-open');
        closeOpenTooltips(tooltip);
        if (!willOpen) {
            hideTooltip(tooltip);
            return;
        }
        showTooltip(tooltip, { pinned: true });
    });

    root.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        closeOpenTooltips();
    });

    document.addEventListener('pointerdown', (event) => {
        if (event.target.closest(`#${ROOT_ID} .aspect-destinia-info-tooltip`)) return;
        closeOpenTooltips();
    }, true);

    const refreshOpenTooltips = () => {
        root.querySelectorAll('.aspect-destinia-info-tooltip').forEach((tooltip) => {
            const { bubble } = getTooltipParts(tooltip);
            if (bubble?.classList.contains('is-active')) {
                updateTooltipPosition(tooltip);
            }
        });
    };

    const closeTooltipsOnScroll = () => {
        closeOpenTooltips();
    };

    window.addEventListener('resize', refreshOpenTooltips);
    window.addEventListener('scroll', closeTooltipsOnScroll, true);

    root.dataset.infoTooltipsBound = 'true';
}
function addFieldResetButtons() {
    const root = document.getElementById(ROOT_ID);
    if (!root) return;

    for (const fieldId of Object.keys(FIELD_DEFAULTS)) {
        const element = root.querySelector(`#${fieldId}`);
        if (!element) continue;
        if (root.querySelector(`.aspect-destinia-field-reset[data-for="${fieldId}"]`)) continue;

        const button = document.createElement('button');
        button.className = 'menu_button aspect-destinia-field-reset';
        button.type = 'button';
        button.dataset.for = fieldId;
        button.textContent = 'Reset';
        button.addEventListener('click', () => resetFieldToDefault(fieldId));

        const sliderMeta = element.parentElement?.querySelector('.aspect-destinia-slider-meta');
        if (sliderMeta) {
            sliderMeta.querySelector(`.aspect-destinia-field-reset[data-for="${fieldId}"]`) || sliderMeta.insertAdjacentElement('afterbegin', button);
        } else if (!element.parentElement?.querySelector(`.aspect-destinia-field-reset[data-for="${fieldId}"]`)) {
            element.insertAdjacentElement('afterend', button);
        }

        if (fieldId === 'timeline_text') {
            let actionRow = element.parentElement?.querySelector('.aspect-destinia-timeline-reset-row');
            if (!actionRow) {
                actionRow = document.createElement('div');
                actionRow.className = 'aspect-destinia-actions aspect-destinia-timeline-reset-row';
                element.insertAdjacentElement('afterend', actionRow);
            }
            if (!actionRow.querySelector(`.aspect-destinia-field-reset[data-for="${fieldId}"]`)) {
                button.remove();
                actionRow.appendChild(button);
            }
            if (!actionRow.querySelector('.aspect-destinia-repair-timeline')) {
                const repairTimelineButton = document.createElement('button');
                repairTimelineButton.className = 'menu_button aspect-destinia-field-reset aspect-destinia-repair-timeline';
                repairTimelineButton.type = 'button';
                repairTimelineButton.textContent = 'Repair';
                repairTimelineButton.title = LABEL_HELP.repair;
                repairTimelineButton.addEventListener('click', repairTimelineJson);
                actionRow.appendChild(repairTimelineButton);
            }
            if (!actionRow.querySelector('.aspect-destinia-reset-objectives')) {
                const resetObjectivesButton = document.createElement('button');
                resetObjectivesButton.className = 'menu_button aspect-destinia-field-reset aspect-destinia-reset-objectives';
                resetObjectivesButton.type = 'button';
                resetObjectivesButton.textContent = 'Reset Objectives';
                resetObjectivesButton.title = LABEL_HELP.reset_objectives;
                resetObjectivesButton.addEventListener('click', resetTimelineObjectives);
                actionRow.appendChild(resetObjectivesButton);
            }
            button.title = LABEL_HELP.reset;
        } else {
            button.title = LABEL_HELP.reset;
        }
    }
}
function ensure_status_panel_shell(statusRoot) {
    if (!statusRoot) return;
    if (statusRoot.dataset.aspectDestiniaStatusInitialized === 'true') return;

    statusRoot.innerHTML = `
        <div class="aspect-destinia-status-grid">
            <div class="aspect-destinia-stat">
                <div class="aspect-destinia-stat-label">Current Plot Point</div>
                <div class="aspect-destinia-stat-value" data-status-field="current-plot-point"></div>
            </div>
            <div class="aspect-destinia-stat">
                <div class="aspect-destinia-stat-label">Next Plot Point</div>
                <div class="aspect-destinia-stat-value" data-status-field="next-plot-point"></div>
            </div>
        </div>
        <div class="aspect-destinia-objective-list">
            <div class="aspect-destinia-section-title aspect-destinia-objective-label">Current Objectives</div>
            <div data-status-field="current-objectives"></div>
        </div>
    `;
    statusRoot.dataset.aspectDestiniaStatusInitialized = 'true';
}
function render_status_panel() {
    const statusRoot = document.getElementById('aspect_destinia_status');
    if (!statusRoot) return;
    ensure_status_panel_shell(statusRoot);

    const { current, next } = getCurrentPlotPoint();
    const currentObjectives = Array.isArray(current?.objectives) ? current.objectives : [];
    const objectiveMarkup = currentObjectives.length
        ? currentObjectives.map((objective) => {
            const label = typeof objective === 'string' ? objective : objective?.text || '';
            const completed = Boolean(typeof objective === 'object' ? objective?.completed : false);
            return `<div class="aspect-destinia-objective-row"><span class="aspect-destinia-objective-icon" aria-hidden="true">${completed ? '☑' : '☐'}</span> <span>${clean_string_for_html(label)} <code>${completed ? 'true' : 'false'}</code></span></div>`;
        }).join('')
        : '<div class="aspect-destinia-empty">No objectives on this plot point.</div>';

    const currentPlotField = statusRoot.querySelector('[data-status-field="current-plot-point"]');
    const nextPlotField = statusRoot.querySelector('[data-status-field="next-plot-point"]');
    const currentObjectivesField = statusRoot.querySelector('[data-status-field="current-objectives"]');

    if (currentPlotField) currentPlotField.textContent = current?.title || 'None';
    if (nextPlotField) nextPlotField.textContent = next?.title || 'None';
    if (currentObjectivesField) currentObjectivesField.innerHTML = objectiveMarkup;
}
function escape_string(text) {
    // escape control characters in the text
    if (!text) return text
    return text.replace(/[\x00-\x1F\x7F]/g, function(match) {
        // Escape control characters
        switch (match) {
          case '\n': return '\\n';
          case '\t': return '\\t';
          case '\r': return '\\r';
          case '\b': return '\\b';
          case '\f': return '\\f';
          default: return '\\x' + match.charCodeAt(0).toString(16).padStart(2, '0');
        }
    });
}
function unescape_string(text) {
    // given a string with escaped characters, unescape them
    if (!text) return text
    return text.replace(/\\[ntrbf0x][0-9a-f]{2}|\\[ntrbf]/g, function(match) {
        switch (match) {
          case '\\n': return '\n';
          case '\\t': return '\t';
          case '\\r': return '\r';
          case '\\b': return '\b';
          case '\\f': return '\f';
          default: {
            // Handle escaped hexadecimal characters like \\xNN
            const hexMatch = match.match(/\\x([0-9a-f]{2})/i);
            if (hexMatch) {
              return String.fromCharCode(parseInt(hexMatch[1], 16));
            }
            return match; // Return as is if no match
          }
        }
    });
}
function assign_and_prune(target, source) {
    // Modifies target in-place while also deleting any keys not in source
    let keys = Object.keys(target).concat(Object.keys(source))
    for (let key of keys) {
        if (!(key in source)) delete target[key];
        else target[key] = source[key];
    }
}
function assign_defaults(target, source) {
    // Modifies target in-place, assigning values only when they don't exist in the target.
    for (let key of Object.keys(source)) {
        if (!(key in target)) target[key] = source[key];
    }
}
function check_objects_different(obj_1, obj_2) {
    // check whether two objects are different by checking each key, recursively
    // if both are objects, recurse on each element of obj_1
    // The "instanceof" method is true for Objects, Arrays, and Sets.
    if (obj_1 instanceof Object && obj_2 instanceof Object) {
        let keys = Object.keys(obj_1).concat(Object.keys(obj_2))
        for (let key of keys) {
            if (check_objects_different(obj_1[key], obj_2[key])) {
                return true  // different
            }
        }
        return false  // not different
    } else {  // not both objects - check equality directly
        return obj_1 !== obj_2  // return if different
    }
}
function regex(string, re) {
    // Returns an array of all matches in capturing groups
    let matches = [...string.matchAll(re)];
    return matches.flatMap(m => m.slice(1).filter(Boolean));
}
function add_i18n($element=null) {
    // dynamically translate config settings
    log("Translating with i18n...")
    if ($element === null) {
        $element = $(`.${settings_content_class}`)
    }

    $element.each(function () {
        let $this = $(this);
        // Find all elements with either text or a title
        $this.find('*').each(function () {
            let $el = $(this);

            // translate title attribute if present
            if ($el.attr('title')) {
                $el.attr('title', translate($el.attr('title')));
            }

            if ($el.attr('placeholder')) {
                $el.attr('placeholder', translate($el.attr('placeholder')));
            }

            // translate the inner text, if present
            if (!this.childNodes) return
            for (let child of this.childNodes) {  // each child node (including text nodes)
                let text = child.nodeValue
                if (!text?.trim()) continue  // null or just whitespace
                child.nodeValue = text?.replace(text?.trim(), translate(text?.trim()))  // replace text with translated text
            }
        });
    })
}

// Completion presets + Connection Manager evaluator request helpers

function normalizeSwitchName(name) {
    return String(name ?? '').trim();
}

function get_current_preset() {
    return getPresetManager().getSelectedPresetName();
}

function getConnectionManagerRequestService() {
    const context = getContext();
    return context?.ConnectionManagerRequestService || null;
}

function getConnectionManagerProfiles() {
    const context = getContext();
    const service = getConnectionManagerRequestService();

    try {
        if (service?.getSupportedProfiles) {
            const profiles = service.getSupportedProfiles();
            if (Array.isArray(profiles)) {
                return profiles
                    .map(profile => ({
                        ...profile,
                        id: normalizeSwitchName(profile?.id),
                        name: normalizeSwitchName(profile?.name),
                    }))
                    .filter(profile => profile.id && profile.name);
            }
        }
    } catch (err) {
        debug('ConnectionManagerRequestService.getSupportedProfiles failed', {
            errorName: err?.name || '',
            errorMessage: err?.message || String(err || ''),
        });
    }

    const profiles = context?.extensionSettings?.connectionManager?.profiles || [];
    if (!Array.isArray(profiles)) return [];

    return profiles
        .map(profile => ({
            ...profile,
            id: normalizeSwitchName(profile?.id),
            name: normalizeSwitchName(profile?.name),
        }))
        .filter(profile => profile.id && profile.name);
}

function getConnectionProfileRecordById(profileId) {
    const targetId = normalizeSwitchName(profileId);
    if (!targetId) return null;

    return getConnectionManagerProfiles().find(profile => profile.id === targetId) || null;
}

function getEvaluatorConnectionProfileId() {
    return normalizeSwitchName(get_settings('evaluator_connection_profile'));
}

function isConnectionManagerAvailable() {
    const service = getConnectionManagerRequestService();
    const context = getContext();

    if (!service) return false;
    if (context?.extensionSettings?.disabledExtensions?.includes?.('connection-manager')) return false;

    return getConnectionManagerProfiles().length > 0;
}

function getConnectionManagerDiagnosticSnapshot() {
    const service = getConnectionManagerRequestService();
    const profiles = getConnectionManagerProfiles().map(profile => ({
        id: profile.id,
        name: profile.name,
        api: profile.api || '',
        preset: profile.preset || '',
    }));

    return {
        active: connection_profiles_active,
        ready: connection_profiles_ready,
        hasService: Boolean(service),
        hasHandleDropdown: Boolean(service?.handleDropdown),
        hasSendRequest: Boolean(service?.sendRequest),
        profileCount: profiles.length,
        selectedEvaluatorProfileId: getEvaluatorConnectionProfileId(),
        profiles,
    };
}

function getConnectionManagerDetectSignature(snapshot) {
    return JSON.stringify({
        active: snapshot.active,
        ready: snapshot.ready,
        hasService: snapshot.hasService,
        hasHandleDropdown: snapshot.hasHandleDropdown,
        hasSendRequest: snapshot.hasSendRequest,
        profileCount: snapshot.profileCount,
        selectedEvaluatorProfileId: snapshot.selectedEvaluatorProfileId,
        profiles: snapshot.profiles.map(profile => `${profile.id}:${profile.name}:${profile.api}:${profile.preset}`),
    });
}

function traceConnectionManagerDetectionIfChanged(snapshot, options = {}) {
    const signature = getConnectionManagerDetectSignature(snapshot);
    const force = Boolean(options.force);

    if (!force && signature === connectionManagerDetectTraceSignature) {
        return;
    }

    connectionManagerDetectTraceSignature = signature;
    trace_debug('ConnectionManager:detect', snapshot);
}

async function detect_connection_profiles_active(options = {}) {
    connection_profiles_active = isConnectionManagerAvailable();
    connection_profiles_ready = true;

    traceConnectionManagerDetectionIfChanged(getConnectionManagerDiagnosticSnapshot(), options);

    return connection_profiles_active;
}

function check_connection_profiles_active() {
    return isConnectionManagerAvailable();
}

function getConnectionProfileApi(profileId = '') {
    const profile = getConnectionProfileRecordById(profileId);
    if (!profile?.api) return undefined;

    const apiMap = CONNECT_API_MAP[profile.api];
    return apiMap?.selected;
}

async function get_presets(profileId = '') {
    const api = profileId ? getConnectionProfileApi(profileId) : undefined;
    const result = getPresetManager().getPresetList(api) || {};
    const presetNames = result.preset_names;

    if (Array.isArray(presetNames)) {
        return presetNames;
    }

    if (presetNames && typeof presetNames === 'object') {
        return Object.keys(presetNames);
    }

    return [];
}

async function verify_preset(name, profileId = '') {
    const targetPreset = normalizeSwitchName(name);

    // Blank evaluator preset is valid; it means "use current preset/default behavior".
    if (!targetPreset) return true;

    const presetNames = await get_presets(profileId);
    return Array.isArray(presetNames) && presetNames.includes(targetPreset);
}

async function check_preset_valid(name = get_settings('evaluator_preset'), options = {}) {
    const { warn = true, profileId = getEvaluatorConnectionProfileId() } = options;
    const targetPreset = normalizeSwitchName(name);

    if (!targetPreset) return true;

    const valid = await verify_preset(targetPreset, profileId);
    if (!valid && warn) {
        toast_debounced(`Your selected evaluator preset "${targetPreset}" is not valid for the selected evaluator profile.`, 'warning');
    }

    return valid;
}

async function get_evaluator_preset(profileId = getEvaluatorConnectionProfileId()) {
    const configuredPreset = normalizeSwitchName(get_settings('evaluator_preset'));

    if (!configuredPreset) {
        return get_current_preset();
    }

    const valid = await verify_preset(configuredPreset, profileId);
    if (valid) {
        return configuredPreset;
    }

    toast_debounced(`Your selected evaluator preset "${configuredPreset}" is not valid for the selected evaluator profile. Falling back to the current preset.`, 'warning');
    return get_current_preset();
}

async function get_evaluator_preset_max_tokens(profileId = getEvaluatorConnectionProfileId()) {
    const presetName = await get_evaluator_preset(profileId);
    const preset = getPresetManager().getCompletionPresetByName(presetName);

    const maxTokens = preset?.genamt || preset?.openai_max_tokens || amount_gen;
    debug(`Got evaluator preset max tokens: ${maxTokens}`);

    return maxTokens;
}

// These are intentionally no-ops now. Destinia no longer mutates SillyTavern's global
// connection profile or completion preset, because this build does not expose /profile commands.
async function get_current_connection_profile() {
    return '';
}

async function get_evaluator_connection_profile() {
    return getEvaluatorConnectionProfileId();
}

async function set_connection_profile(_profileIdOrName, options = {}) {
    debug('Skipping global connection profile switch; evaluator uses ConnectionManagerRequestService.sendRequest when a profile is selected.', {
        reason: options?.reason || '',
    });
    return true;
}

async function set_preset(_name, options = {}) {
    debug('Skipping global preset switch; evaluator uses ConnectionManagerRequestService.sendRequest when a profile is selected.', {
        reason: options?.reason || '',
    });
    return true;
}

async function get_connection_profiles() {
    return getConnectionManagerProfiles().map(profile => profile.id);
}

async function verify_connection_profile(profileId) {
    const targetId = normalizeSwitchName(profileId);
    if (!targetId) return true;

    return Boolean(getConnectionProfileRecordById(targetId));
}

async function check_connection_profile_valid(profileId = getEvaluatorConnectionProfileId(), options = {}) {
    const { warn = true } = options;
    const targetId = normalizeSwitchName(profileId);

    if (!targetId) return true;

    const profile = getConnectionProfileRecordById(targetId);
    if (!profile) {
        if (warn) {
            toast_debounced('Your selected evaluator connection profile no longer exists.', 'warning');
        }

        trace_debug('EvaluatorConnectionProfileSetting:invalidId', {
            profileId: targetId,
            availableProfiles: getConnectionManagerProfiles().map(item => ({
                id: item.id,
                name: item.name,
                api: item.api || '',
                preset: item.preset || '',
            })),
        });

        return false;
    }

    return true;
}

function extractEvaluatorResponseText(response) {
    if (typeof response === 'string') return response;

    if (response && typeof response === 'object') {
        if (typeof response.content === 'string') return response.content;
        if (typeof response.text === 'string') return response.text;
        if (typeof response.message === 'string') return response.message;
        if (typeof response.output_text === 'string') return response.output_text;
        if (typeof response?.message?.content === 'string') return response.message.content;
        if (typeof response?.choices?.[0]?.message?.content === 'string') return response.choices[0].message.content;
        if (typeof response?.choices?.[0]?.text === 'string') return response.choices[0].text;
        if (response.data) return extractEvaluatorResponseText(response.data);
    }

    return String(response ?? '');
}

async function sendEvaluatorRequest(prompt, profileId = '') {
    const targetProfileId = normalizeSwitchName(profileId);
    const service = getConnectionManagerRequestService();
    const profile = targetProfileId ? getConnectionProfileRecordById(targetProfileId) : null;

    if (targetProfileId && profile && service?.sendRequest) {
        const maxTokens = await get_evaluator_preset_max_tokens(targetProfileId);

        trace_debug('EvaluatorRequest:connectionManager', {
            profileId: profile.id,
            profileName: profile.name,
            profileApi: profile.api || '',
            profilePreset: profile.preset || '',
            requestedPreset: get_settings('evaluator_preset') || '',
            maxTokens,
        });

        const response = await service.sendRequest(profile.id, prompt, maxTokens, {
            extractData: true,
            includePreset: true,
            includeInstruct: true,
        });

        return extractEvaluatorResponseText(response);
    }

    trace_debug('EvaluatorRequest:generateRawFallback', {
        reason: targetProfileId ? 'Connection Manager profile/service unavailable' : 'No evaluator profile selected',
        profileId: targetProfileId,
        hasService: Boolean(service),
        hasSendRequest: Boolean(service?.sendRequest),
    });

    return await generateRaw({
        prompt,
        trimNames: false,
    });
}

// Settings Management
function initialize_settings() {
    if (extension_settings[MODULE_NAME] !== undefined) {  // setting already initialized
        log("Settings already initialized.")
        soft_reset_settings();
    } else {  // no settings present, first time initializing
        log("Extension settings not found. Initializing...")
        hard_reset_settings();
    }

    // load default profile
    load_profile();
}
function hard_reset_settings() {
    // Set the settings to the completely fresh values, deleting all profiles too
    if (global_settings['profiles']['Default'] === undefined) {  // if the default profile doesn't exist, create it
        global_settings['profiles']['Default'] = stripTimelineStateFromProfileSettings(default_settings);
    }
    extension_settings[MODULE_NAME] = structuredClone({
        ...default_settings,
        ...global_settings
    });
}
function soft_reset_settings() {
    // fix any missing settings without destroying profiles
    extension_settings[MODULE_NAME] = Object.assign(
        structuredClone(default_settings),
        structuredClone(global_settings),
        extension_settings[MODULE_NAME]
    );

    // check for any missing profiles
    let profiles = get_settings('profiles');
    if (Object.keys(profiles).length === 0) {
    log("No profiles found, creating default profile.")
        profiles['Default'] = stripTimelineStateFromProfileSettings(default_settings);
        set_settings('profiles', profiles);
} else { // for each existing profile, add any missing default settings without overwriting existing settings
        for (let [profile, settings] of Object.entries(profiles)) {
            profiles[profile] = stripTimelineStateFromProfileSettings(
            Object.assign(structuredClone(default_settings), settings)
            );
        }
        set_settings('profiles', profiles);
    }
}
function reset_settings() {
    // reset the current profile-specific settings to default
    Object.assign(extension_settings[MODULE_NAME], structuredClone(default_settings))
    refresh_settings();   // refresh the UI
}
function set_settings(key, value, copy=false) {
    // Set a setting for the extension and save it
    if (copy) {
        value = structuredClone(value)
    }
    extension_settings[MODULE_NAME][key] = value;
    saveSettingsDebounced();
}
function get_settings(key, copy=false) {
    // Get a setting for the extension, or the default value if not set
    let value = extension_settings[MODULE_NAME]?.[key] ?? default_settings[key];
    if (copy) {  // needed when retrieving objects
        return structuredClone(value)
    } else {
        return value
    }

}
function set_chat_metadata(key, value, copy=false) {
    // Set a key and value in chat metadata (persists with branches)
    if (copy) {
        value = structuredClone(value);
    }
    if (!chat_metadata[MODULE_NAME]) chat_metadata[MODULE_NAME] = {};
    chat_metadata[MODULE_NAME][key] = value;
    saveMetadataDebounced();
}
function get_chat_metadata(key, copy=false) {
    // Get a key from chat metadata
    let value = chat_metadata[MODULE_NAME]?.[key]
    if (copy) {  // needed when retrieving objects
        return structuredClone(value)
    } else {
        return value
    }
}

function get_settings_element(key) {
    return settings_ui_map[key]?.[0]
}
async function get_manifest() {
    // Get the manifest.json for the extension
    let module_dir = get_extension_directory();
    let path = `${module_dir}/manifest.json`
    let response = await fetch(path)
    if (response.ok) {
        return await response.json();
    }
    error(`Error getting manifest.json from "${path}": status: ${response.status}`);
}
async function load_settings_html() {
    // fetch the settings html file and append it to the settings div.
    log("Loading settings.html...")

    let module_dir = get_extension_directory()
    let path = `${module_dir}/settings.html`
    let found = await $.get(path).then(async response => {
        log(`Loaded settings.html at "${path}"`)
        $("#extensions_settings2").append(response);  // load html into the settings div
        return true
    }).catch((response) => {
        error(`Error getting settings.json from "${path}": status: ${response.status}`);
        return false
    })

    return new Promise(resolve => resolve(found))
}
function chat_enabled() {
    // check if the extension is enabled in the current chat

    // global state
    if (get_settings('use_global_toggle_state')) {
        return get_settings('global_toggle_state')
    }

    // per-chat state
    return get_chat_metadata('enabled') ?? get_settings('default_chat_enabled')
}
function toggle_chat_enabled(value=null) {
    // Change the state of the extension. If value is null, toggle. Otherwise, set to the given value
    let current = chat_enabled();

    if (value === null) {  // toggle
        value = !current;
    } else if (value === current) {
        return;  // no change
    }

    // set the new value
    if (get_settings('use_global_toggle_state')) {   // using the global state - update the global state
        set_settings('global_toggle_state', value);
    } else {  // using per-chat state - update the chat state
        set_chat_metadata('enabled', value);
    }


    if (value) {
        toastr.info(`Aspect: Destinia guidance is now enabled for this chat`);
    } else {
        toastr.warning(`Aspect: Destinia guidance is now disabled for this chat`);
    }
    refresh_guidance()

    // update the message visuals
    update_all_message_visuals()

    // refresh settings UI
    refresh_settings()

    // scroll to the bottom of the chat
    scrollChatToBottom()
}
/**
 * Bind a UI element to a setting.
 * @param selector {string} jQuery Selector for the UI element
 * @param key {string} Key of the setting
 * @param type {string} Type of the setting (number, boolean)
 * @param callback {function} Callback function to run when the setting is updated
 * @param disable {boolean} Whether to disable the element when chat is disabled
 */
function bind_setting(selector, key, type=null, callback=null, disable=true) {
    // Bind a UI element to a setting, so if the UI element changes, the setting is updated
    selector = `.${settings_content_class} ${selector}`  // add the settings div to the selector
    let element = $(selector)
    if (element.length === 0) {
        error(`No element found for selector [${selector}] for setting [${key}]`);
        return;
    }
    settings_ui_map[key] = [element, type]

    // if no elements found, log error

    // mark as a settings UI function
    if (disable) {
        element.addClass('settings_input');
    }

    // default trigger for a settings update is on a "change" event (as opposed to an input event)
    let trigger = element.is('textarea') ? 'input' : 'change';

    // Set the UI element to the current setting value
    set_setting_ui_element(key, element, type);

    // Make the UI element update the setting when changed
    element.on(trigger, function (event) {
        let value;
        if (type === 'number') {  // number input
            value = Number($(this).val());
        } else if (type === 'boolean') {  // checkbox
            value = Boolean($(this).prop('checked'));
        } else {  // text, dropdown, select2
            value = $(this).val();
            if (!$(this).is('textarea')) {
                value = unescape_string(value)  // ensures values like "\n" are NOT escaped from single-line input
            }
        }

        // update the setting
        debug(`Setting Triggered: [${key}] [${value}]`)
        set_settings(key, value)

        // trigger callback if provided, passing the new value
        if (callback !== null) {
            callback(value);
        }

        // update only the settings surfaces that should track ordinary field edits
        sync_settings_ui_after_change();

        // refresh Destinia guidance/state after settings changes
        if (trigger === 'change') {
            refresh_guidance();
        } else if (trigger === 'input') {
            refresh_guidance_debounced();
        }
    });
}
function bindTimelineEditor() {
    const selector = `.${settings_content_class} #timeline_text`;
    const element = $(selector);

    if (element.length === 0) {
        error(`No element found for selector [${selector}] for setting [timeline_text]`);
        return;
    }

    settings_ui_map.timeline_text = [element, 'text'];
    element.addClass('settings_input');

    set_setting_ui_element('timeline_text', element, 'text');

    element
        .off('input.aspectDestiniaTimelineEditor change.aspectDestiniaTimelineEditor')
        .on('input.aspectDestiniaTimelineEditor', function () {
            const rawTimelineText = String($(this).val() || '');
            const timelineResult = getValidatedTimelineText(rawTimelineText);

            updateFieldValidationIndicators();

            // Do not poison the live source with invalid partial JSON.
            // Once the JSON becomes valid, it immediately becomes the source of truth.
            if (!timelineResult.valid) {
                updateTimelinePresetControls();
                return;
            }

            commitTimelineText(rawTimelineText, {
                updateEditor: false,
                refreshGuidanceNow: false,
                refreshStatusNow: true,
                showInvalidToast: false,
            });

            refresh_guidance_debounced();
        })
        .on('change.aspectDestiniaTimelineEditor', function () {
            const rawTimelineText = String($(this).val() || '');

            commitTimelineText(rawTimelineText, {
                updateEditor: true,
                refreshGuidanceNow: true,
                refreshStatusNow: true,
                showInvalidToast: true,
            });
        });
}
function bind_function(selector, func, disable=true) {
    // bind a function to an element (typically a button or input)
    // if disable is true, disable the element if chat is disabled
    selector = `.${settings_content_class} ${selector}`
    let element = $(selector);
    if (element.length === 0) {
        error(`No element found for selector [${selector}] when binding function`);
        return;
    }

    // mark as a settings UI element
    if (disable) {
        element.addClass('settings_input');
    }

    // check if it's an input element, and bind a "change" event if so
    if (element.is('input')) {
        element.on('change', function (event) {
            func(event);
        });
    } else {  // otherwise, bind a "click" event
        element.on('click', function (event) {
            func(event);
        });
    }
}
function set_setting_ui_element(key, element, type) {
    // Set a UI element to the current setting value
    let radio = false;
    if (element.is('input[type="radio"]')) {
        radio = true;
    }

    // get the setting value
    let setting_value = get_settings(key);
    if (type === "text" && !element.is('textarea')) {
        setting_value = escape_string(setting_value)  // escape values like "\n" for single-line inputs only
    }

    // initialize the UI element with the setting value
    if (radio) {  // if a radio group, select the one that matches the setting value
        let selected = element.filter(`[value="${setting_value}"]`)
        if (selected.length === 0) {
            error(`Error: No radio button found for value [${setting_value}] for setting [${key}]`);
            return;
        }
        selected.prop('checked', true);
    } else {  // otherwise, set the value directly
        if (type === 'boolean') {  // checkbox
            element.prop('checked', setting_value);
        } else {  // text input or dropdown
            element.val(setting_value);
        }
    }
}
function update_save_icon_highlight() {
    // If the current settings are different than the current profile, highlight the save button
    if (detect_settings_difference()) {
        $('#save_profile').addClass('button_highlight');
    } else {
        $('#save_profile').removeClass('button_highlight');
    }
}
function update_profile_section() {
    let current_profile = get_settings('profile')
    let current_character_profile = get_character_profile();
    let current_chat_profile = get_chat_profile();
    let profile_options = Object.keys(get_settings('profiles'));
    let knownChats = get_settings('known_chats', true) || {};
    let chatProfiles = get_settings('chat_profiles', true) || {};
    let attachedChatKey = Object.entries(chatProfiles).find(([, profileName]) => profileName === current_profile)?.[0] || '';

    let $choose_profile_dropdown = $(`.${settings_content_class} #profile`);
    let $chatProfileSelect = $(`.${settings_content_class} #chat_profile_select`);
    const profileElement = $choose_profile_dropdown.get(0);
    const chatProfileElement = $chatProfileSelect.get(0);

    if (document.activeElement !== profileElement) {
        $choose_profile_dropdown.empty();
        for (let profile of profile_options) {
            let text = profile
            let html_safe_name = clean_string_for_html(profile)
            if (profile === current_character_profile) {
                text = `${profile} (${t`Character`})`
            } else if (profile === current_chat_profile) {
                text = `${profile} (${t`Chat`})`
            }
            $choose_profile_dropdown.append(`<option value="${html_safe_name}">${text}</option>`);
        }
        $choose_profile_dropdown.val(current_profile);
    }

    if (document.activeElement !== chatProfileElement) {
        $chatProfileSelect.empty();
        $chatProfileSelect.append('<option value="">-- No Attached Chat --</option>');
        Object.values(knownChats)
            .sort((a, b) => (b?.lastSeen || 0) - (a?.lastSeen || 0))
            .forEach((chatInfo) => {
                $chatProfileSelect.append(`<option value="${clean_string_for_html(chatInfo.key)}">${clean_string_for_html(chatInfo.label || chatInfo.key)}</option>`);
            });
        if (attachedChatKey && !knownChats[attachedChatKey]) {
            $chatProfileSelect.append(`<option value="${clean_string_for_html(attachedChatKey)}">${clean_string_for_html(attachedChatKey)}</option>`);
        }
        if (attachedChatKey) {
            $chatProfileSelect.val(attachedChatKey);
        } else {
            $chatProfileSelect.val('');
        }
    }

}

function updateTimelinePresetControls() {
    const presetId = String(get_settings('selected_timeline_preset') || '').trim();
    const renameButton = document.querySelector(`.${settings_content_class} #timeline_preset_rename`);
    const deleteButton = document.querySelector(`.${settings_content_class} #timeline_preset_delete`);
    const saveButton = document.querySelector(`.${settings_content_class} #timeline_preset_save`);
    const duplicateButton = document.querySelector(`.${settings_content_class} #timeline_preset_duplicate`);
    const exportButton = document.querySelector(`.${settings_content_class} #timeline_export`);
    const timelineElement = document.querySelector(`.${settings_content_class} #timeline_text`);
    const hasPreset = Boolean(presetId);
    const isDefaultPreset = presetId === 'default_timeline_preset';
    const presets = get_settings('timeline_presets', true) || {};
    const rawPresetTimelineText = String(presets[presetId]?.timelineText || '');
const rawEditorTimelineText = String(timelineElement?.value || get_settings('timeline_text') || '');

const presetTimelineResult = getValidatedTimelineText(rawPresetTimelineText);
const editorTimelineResult = getValidatedTimelineText(rawEditorTimelineText);

const presetTimelineText = presetTimelineResult.valid
    ? presetTimelineResult.timelineText
    : rawPresetTimelineText;

const editorTimelineText = editorTimelineResult.valid
    ? editorTimelineResult.timelineText
    : rawEditorTimelineText;

const hasUnsavedTimelineChanges = hasPreset && editorTimelineText !== presetTimelineText;

    if (renameButton) {
        renameButton.disabled = !hasPreset;
    }
    if (deleteButton) {
        deleteButton.disabled = !hasPreset || isDefaultPreset;
    }
    if (saveButton) {
        saveButton.disabled = !hasPreset;
        saveButton.classList.toggle('button_highlight', hasUnsavedTimelineChanges);
    }
    if (duplicateButton) {
        duplicateButton.disabled = !hasPreset;
    }
    if (exportButton) {
        exportButton.disabled = !hasPreset;
    }
}

async function update_preset_dropdown() {
    const $preset_select = $(`.${settings_content_class} #evaluator_preset`);
    if ($preset_select.length === 0) return;

    const presetElement = $preset_select.get(0);
    const selectedPreset = get_settings('evaluator_preset');
    const evaluatorProfileId = getEvaluatorConnectionProfileId();
    const preset_options = await get_presets(evaluatorProfileId);

    if (document.activeElement !== presetElement) {
        $preset_select.empty();
        $preset_select.append(`<option value="">${t`Same as Current`}</option>`);

        for (const option of preset_options) {
            $preset_select.append(`<option value="${clean_string_for_html(option)}">${clean_string_for_html(option)}</option>`);
        }

        $preset_select.val(selectedPreset);
    }

    $preset_select.off('click.aspectDestiniaPreset').on('click.aspectDestiniaPreset', () => update_preset_dropdown());
}

function get_saved_evaluator_connection_profile_id() {
    const savedId = getEvaluatorConnectionProfileId();
    if (!savedId) return '';

    const profile = getConnectionProfileRecordById(savedId);
    return profile?.id || '';
}

function setEvaluatorConnectionProfileId(profileId) {
    const cleanId = normalizeSwitchName(profileId);
    const profile = cleanId ? getConnectionProfileRecordById(cleanId) : null;
    const nextId = profile?.id || '';

    const previousId = getEvaluatorConnectionProfileId();
    if (nextId === previousId) return;

    set_settings('evaluator_connection_profile', nextId);

    trace_debug('EvaluatorConnectionProfileSetting:changed', {
        previousId,
        nextId,
        selectedProfileName: profile?.name || '',
        availableProfiles: getConnectionManagerProfiles().map(item => ({
            id: item.id,
            name: item.name,
            api: item.api || '',
            preset: item.preset || '',
        })),
    });

    update_preset_dropdown();
    check_connection_profile_valid(nextId);
}

function initialize_connection_profile_dropdown() {
    const selector = `.${settings_content_class} #evaluator_connection_profile`;
    const $connectionSelect = $(selector);
    if (!$connectionSelect.length) return false;

    const service = getConnectionManagerRequestService();
    const profiles = getConnectionManagerProfiles();
    const savedId = getEvaluatorConnectionProfileId();
    const selectedId = get_saved_evaluator_connection_profile_id();

    if (!service?.handleDropdown || profiles.length === 0) {
        connection_profiles_active = false;
        connection_profiles_ready = true;

        trace_debug('ConnectionManagerDropdown:unavailable', {
            hasService: Boolean(service),
            hasHandleDropdown: Boolean(service?.handleDropdown),
            profileCount: profiles.length,
        });

        return false;
    }

    // If the saved value is not a valid profile ID, clear it. Do not attempt old name recovery.
    if (savedId && !selectedId) {
        trace_debug('EvaluatorConnectionProfileSetting:clearedInvalidId', {
            savedId,
            availableProfiles: profiles.map(item => ({
                id: item.id,
                name: item.name,
                api: item.api || '',
                preset: item.preset || '',
            })),
        });

        set_settings('evaluator_connection_profile', '');
    }

    if ($connectionSelect.data('aspectDestiniaCmBound') === true) {
        $connectionSelect.val(selectedId);
        connection_profiles_active = true;
        connection_profiles_ready = true;
        return true;
    }

    service.handleDropdown(
        selector,
        selectedId,
        (profile) => {
            setEvaluatorConnectionProfileId(profile?.id || '');
        },
        (profile) => {
            setEvaluatorConnectionProfileId(profile?.id || '');
        },
        (oldProfile, newProfile) => {
            const currentId = getEvaluatorConnectionProfileId();
            if (currentId && oldProfile?.id === currentId) {
                setEvaluatorConnectionProfileId(newProfile?.id || '');
            }
        },
        (profile) => {
            const currentId = getEvaluatorConnectionProfileId();
            if (currentId && profile?.id === currentId) {
                setEvaluatorConnectionProfileId('');
            }
        }
    );

    $connectionSelect.data('aspectDestiniaCmBound', true);
    connection_profiles_active = true;
    connection_profiles_ready = true;
    return true;
}

function updateTimelinePresetDropdown() {
    const $presetSelect = $(`.${settings_content_class} #timeline_preset`);
    if (!$presetSelect.length) return;
    const presetElement = $presetSelect.get(0);
    const presets = get_settings('timeline_presets') || {};
    let selected = get_settings('selected_timeline_preset') || 'default_timeline_preset';
    if (!presets[selected]) {
        selected = 'default_timeline_preset';
        set_settings('selected_timeline_preset', selected);
    }

    if (document.activeElement !== presetElement) {
        $presetSelect.empty();
        Object.entries(presets).forEach(([id, preset]) => {
            $presetSelect.append(`<option value="${clean_string_for_html(id)}">${clean_string_for_html(preset?.name || id)}</option>`);
        });
        $presetSelect.val(selected);
    }

    updateTimelinePresetControls();
}

function ensureDefaultTimelinePreset() {
    const presets = get_settings('timeline_presets', true) || {};
    if (!presets.default_timeline_preset) {
        presets.default_timeline_preset = {
            name: 'Default Timeline',
            timelineText: JSON.stringify(DEFAULT_TIMELINE_TEMPLATE, null, 2)
        };
    }
    let selectedPreset = get_settings('selected_timeline_preset');
    if (!selectedPreset || !presets[selectedPreset]) {
        selectedPreset = 'default_timeline_preset';
        set_settings('selected_timeline_preset', selectedPreset);
    }
    set_settings('timeline_presets', presets);
}

function createTimelinePreset(duplicate = false) {
    const presets = get_settings('timeline_presets', true) || {};
    const sourcePresetId = duplicate ? get_settings('selected_timeline_preset') : null;
    const sourcePreset = sourcePresetId ? presets[sourcePresetId] : null;
    let id = `timeline_preset_${Date.now()}`;
    while (presets[id]) {
        id = `timeline_preset_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    }
    presets[id] = {
        name: duplicate && sourcePreset ? `${sourcePreset.name || 'Timeline Preset'} Copy` : 'New Timeline Preset',
        timelineText: duplicate && sourcePreset
            ? String(sourcePreset.timelineText || JSON.stringify(DEFAULT_TIMELINE_TEMPLATE, null, 2))
            : (get_settings('timeline_text') || JSON.stringify(DEFAULT_TIMELINE_TEMPLATE, null, 2))
    };
    set_settings('timeline_presets', presets);
    set_settings('selected_timeline_preset', id);
    refresh_settings_for_timeline_controls();
}
async function renameSelectedTimelinePreset() {
    const presetId = get_settings('selected_timeline_preset');
    const presets = get_settings('timeline_presets', true) || {};
    const preset = presetId ? presets[presetId] : null;
    if (!preset) return;

    const nextName = await getContext().Popup.show.input('Rename Timeline Preset', 'Enter a new timeline preset name:', String(preset.name || 'Timeline Preset'));
    const trimmed = String(nextName || '').trim();
    if (!trimmed || trimmed === preset.name) return;

    preset.name = trimmed;
    presets[presetId] = preset;
    set_settings('timeline_presets', presets);
    refresh_settings_for_timeline_controls();
}

function stepPlotPoint(delta = 0) {
    const { points, currentIndex } = getCurrentPlotPoint();
    if (!Array.isArray(points) || !points.length) return;
    const nextIndex = Math.max(0, Math.min(currentIndex + Number(delta || 0), points.length - 1));
    const nextPoint = points[nextIndex];
    if (!nextPoint) return;
    const timeline = getDestiniaTimeline();
    trace_debug('ManualPlotPointChange', {
        action: 'step',
        delta,
        previousCurrentPlotPoint: timeline.currentPlotPoint,
        nextCurrentPlotPoint: nextPoint.id,
    });
    timeline.currentPlotPoint = nextPoint.id;
    timeline.transitionFrom = null;
    timeline.transitionTo = null;
    const nextTimelineText = JSON.stringify(timeline, null, 2);
commitTimelineText(nextTimelineText);
}

function resetPlotPointToFirst() {
    const timeline = getDestiniaTimeline();
    const firstPoint = Array.isArray(timeline.plotPoints) ? timeline.plotPoints[0] : null;
    if (!firstPoint) return;
    trace_debug('ManualPlotPointChange', {
        action: 'reset_to_first',
        previousCurrentPlotPoint: timeline.currentPlotPoint,
        nextCurrentPlotPoint: firstPoint.id,
    });
    timeline.currentPlotPoint = firstPoint.id;
    timeline.transitionFrom = null;
    timeline.transitionTo = null;
    const nextTimelineText = JSON.stringify(timeline, null, 2);
commitTimelineText(nextTimelineText);
}

function saveSelectedTimelinePreset() {
    const editor = getTimelineEditorElement();
    const rawTimelineText = editor ? String(editor.value || '') : String(get_settings('timeline_text') || '');

    const saved = commitTimelineText(rawTimelineText, {
        updateEditor: true,
        refreshGuidanceNow: true,
        refreshStatusNow: true,
        showInvalidToast: true,
    });

    if (saved) {
        toast('Timeline preset saved.', 'success');
    }
}

async function deleteSelectedTimelinePreset() {
    const presetId = get_settings('selected_timeline_preset');
    if (!presetId || presetId === 'default_timeline_preset') return;
    const presets = get_settings('timeline_presets', true) || {};
    const presetName = presets[presetId]?.name || presetId;
    const confirmed = await getContext().Popup.show.confirm(`Delete timeline preset: "${presetName}"?`, '', { okButton: 'Delete', cancelButton: 'Cancel' });
    if (!confirmed) return;
    delete presets[presetId];
set_settings('timeline_presets', presets);
set_settings('selected_timeline_preset', 'default_timeline_preset');

syncTimelineTextFromSelectedPreset({
    updateEditor: true,
    refreshGuidanceNow: true,
    refreshStatusNow: true,
});
}
function exportTimelineToFile() {
    const timelineResult = getValidatedTimelineText(get_settings('timeline_text'));
    if (!timelineResult.valid) {
        toast(`Cannot export invalid timeline: ${timelineResult.issues.join('; ')}`, 'warning');
        updateFieldValidationIndicators();
        return;
    }
    download(timelineResult.timelineText, 'timeline.json', 'application/json');
}
async function importTimelineFromFile(event) {
    const file = event?.target?.files?.[0];
    if (!file) return;
    try {
        const imported = await parseJsonFile(file);
        const timelineResult = getValidatedTimelineText(JSON.stringify(imported, null, 2));
        if (!timelineResult.valid) {
            toast(`Failed to import timeline: ${timelineResult.issues.join('; ')}`, 'warning');
            updateFieldValidationIndicators();
            return;
        }
        commitTimelineText(timelineResult.timelineText, {
    updateEditor: true,
    refreshGuidanceNow: true,
    refreshStatusNow: true,
});

toast('Imported timeline into the selected timeline preset.', 'success');
    } finally {
        event.target.value = null;
    }
}
async function clearCurrentChatMessages() {
    const ctx = getContext();
    const count = Array.isArray(ctx.chat) ? ctx.chat.length : 0;
    if (!count) {
        toast('Current chat is already empty.', 'info');
        return;
    }

    const confirmed = await ctx.Popup.show.confirm(`Delete ${count} current chat message(s)?`, 'This cannot be undone.', { okButton: 'Delete', cancelButton: 'Cancel' });
    if (!confirmed) return;

    try {
        if (typeof ctx.clearChat === 'function') {
            await ctx.clearChat();
        }

        if (Array.isArray(ctx.chat)) {
            ctx.chat.splice(0, ctx.chat.length);
        } else {
            ctx.chat = [];
        }

        if (typeof ctx.saveChat === 'function') {
            await ctx.saveChat();
        }

        update_all_message_visuals();
        render_status_panel();
        toast(`Deleted ${count} message(s) from the current chat.`, 'success');
    } catch (error) {
        error(`Failed to clear current chat: ${error?.message || error}`);
    }
}
async function freshResetExtensionState() {
    const ctx = getContext();
    const confirmed = await ctx.Popup.show.confirm('Fresh reset extension state for the current chat?', 'This will clear current diagnostics, reset the current plot point to the beginning, clear objective completion state, restore the visible timeline objective booleans for the current chat to false, and reset non-Timeline JSON inputs to their coded defaults. It will not delete your timeline presets or profile definitions.', { okButton: 'Reset', cancelButton: 'Cancel' });
    if (!confirmed) return;

    const nonTimelineDefaultKeys = [
        'strictness',
        'pacing_bias',
        'objective_auto_advance_threshold',
        'objective_evaluation_method',
        'intent_window',
        'progression_rule',
        'foreshadow_next_plot_point',
        'messages_evaluated',
        'timeline_deviation_allowed',
        'auto_resolve_deviation',
        'detach_enabled',
        'detach_instruction',
        'guidance_intro',
        'guidance_principles',
        'current_plot_point_template',
        'next_plot_point_template',
        'transition_template',
        'objective_guidance_template',
        'intent_progression_rule',
        'progression_instruction',
        'pacing_instruction',
        'objective_completion_guidance',
        'foreshadowing_template',
        'timeline_deviation_instruction',
        'auto_resolve_deviation_instruction',
        'guidance_outro',
        'evaluator_prompt',
        'guidance_position',
        'guidance_depth',
        'guidance_role',
        'guidance_scan',
        'debug_mode',
        'display_memories',
    ];
    for (const key of nonTimelineDefaultKeys) {
        set_settings(key, structuredClone(default_settings[key]));
    }

    const timeline = getDestiniaTimeline();
    const firstPoint = Array.isArray(timeline.plotPoints) ? timeline.plotPoints[0] : null;
    if (firstPoint) {
        timeline.currentPlotPoint = firstPoint.id;
    }
    timeline.transitionFrom = null;
    timeline.transitionTo = null;
    if (Array.isArray(timeline.plotPoints)) {
    timeline.plotPoints = timeline.plotPoints.map((plotPoint) => {
        if (!Array.isArray(plotPoint?.objectives)) return plotPoint;

        return {
            ...plotPoint,
            objectives: plotPoint.objectives.map((objective) => {
                const normalized = normalizeObjectiveItem(objective);
                normalized.completed = false;
                return normalized;
            }),
        };
    });
}

commitTimelineText(JSON.stringify(timeline, null, 2), {
    updateEditor: true,
    refreshGuidanceNow: true,
    refreshStatusNow: true,
});

    const chat = Array.isArray(ctx.chat) ? ctx.chat : [];
    for (const message of chat) {
        if (message?.extra?.[MODULE_NAME]) {
            delete message.extra[MODULE_NAME].diagnostic;
            delete message.extra[MODULE_NAME].current_plot_title;
            if (!Object.keys(message.extra[MODULE_NAME]).length) {
                delete message.extra[MODULE_NAME];
            }
        }
    }

    if (typeof ctx.saveChat === 'function') {
        await ctx.saveChat();
    }

    refresh_settings();
    refresh_guidance();
    update_all_message_visuals();
    render_status_panel();
    toast('Extension state reset for fresh testing.', 'success');
}

async function apply_structural_settings_surfaces() {
    await detect_connection_profiles_active();

    const connectionField = $(`.${settings_content_class} #evaluator_connection_profile`).closest('.aspect-destinia-field');
    const connectionDropdownReady = initialize_connection_profile_dropdown();

    if (connectionDropdownReady) {
        connectionField.show();
        await check_connection_profile_valid();
    } else {
        connectionField.hide();
        debug('Connection Manager request service is unavailable. Hiding evaluator connection profile dropdown.');
    }

    await update_preset_dropdown();
    await check_preset_valid();

    update_profile_section();
    ensureDefaultTimelinePreset();
    updateTimelinePresetDropdown();
    addFieldResetButtons();
    addInfoTipsToSettings();
    setupInfoTooltips();
}

function apply_common_settings_surfaces() {
    update_save_icon_highlight();
    update_slider_displays();
    updateFieldValidationIndicators();

    if (chat_enabled()) {
        $(`.${settings_content_class} .settings_input`).prop('disabled', false);
    } else {
        $(`.${settings_content_class} .settings_input`).prop('disabled', true);
    }
}

function sync_settings_ui_after_change() {
    apply_common_settings_surfaces();
}
function refresh_settings_for_structure() {
    refresh_settings();
}
function refresh_settings_for_profile_section() {
    update_profile_section();
    update_save_icon_highlight();
    updateFieldValidationIndicators();
}
function refresh_settings_for_timeline_controls() {
    ensureDefaultTimelinePreset();
    updateTimelinePresetDropdown();
    update_save_icon_highlight();
    update_slider_displays();
    updateFieldValidationIndicators();
}
function refresh_settings() {
    // Refresh all settings UI elements according to the current settings
    debug("Refreshing settings...")

    apply_structural_settings_surfaces();

    // Guidance placement controls remain user-tunable; no legacy summary-context token displays are needed here.

    // iterate through the settings map and set each element to the current setting value
    for (let [key, [element, type]] of Object.entries(settings_ui_map)) {
        set_setting_ui_element(key, element, type);
    }

    render_status_panel();
    apply_common_settings_surfaces();
}

function refresh_select2_element(element, selected, options, placeholder="", callback) {
    // Refresh a select2 element with the given select element (or ID) and set the options
    /*
    Use like this:
    <div class="flex-container justifySpaceBetween alignItemsCenter">
        <label title="description here">
            <span>label here</span>
            <select id="id_here" multiple="multiple"></select>
        </label>
    </div>
     */
    let $select = element
    let id;
    if (typeof(element) === "string") {
        $select = $(`#${element}`)
        id = element
    } else {
        id = element.attr('id')
    }

    // check whether the dropdown is open. If so, don't update the options (it messes with the widget)
    let $dropdown = $(`#select2-${id}-results`)
    if ($dropdown.length > 0) {
        return
    }

    $select.empty()  // clear current options

    // add the options to the dropdown
    for (let {id, name} of options) {
        name = clean_string_for_html(name)
        let option = $(`<option value="${id}">${name}</option>`)
        $select.append(option);
    }

    // If the select2 widget hasn't been created yet, create it
    let $widget = $(`.${settings_content_class} ul#select2-${id}-container`)
    if ($widget.length === 0) {
        $select.select2({  // register as a select2 element
            width: '100%',
            placeholder: placeholder,
            allowClear: true,
            closeOnSelect: false,
            dropdownParent: $select.parent()
        });

        $select.on('change', () => {
            let values = []
            for (let value of $select.select2('data')) {
                values.push(value.text)
            }
            callback(values)
        })

        // select2ChoiceClickSubscribe($select, () => {
        //     log("CLICKED")
        // }, {buttonStyle: true, closeDrawer: true});

        //$select.on('select2:unselect', unselect_callback);
        //$select.on('select2:select', select_callback);
    }

    // set current selection.
    // change.select2 lets the widget update itself, but doesn't trigger the change event (which would cause infinite recursion).
    $select.val(selected)
    $select.trigger('change.select2')
}


// Profile management
function copy_settings(profile=null) {
    // copy the setting from the given profile (or current settings if none provided)
    let settings;

    if (!profile) {  // no profile given, copy current settings
        settings = structuredClone(extension_settings[MODULE_NAME]);
    } else {  // copy from the profile
        let profiles = get_settings('profiles');
        if (profiles[profile] === undefined) {  // profile doesn't exist, return empty
            return {}
        }

        // copy the settings from the profile
        settings = structuredClone(profiles[profile]);
    }

    // remove global settings from the copied settings
    for (let key of Object.keys(global_settings)) {
        delete settings[key];
    }

    // hard guarantee: profiles never compare/save/load timeline state
    settings = stripTimelineStateFromProfileSettings(settings);

    return settings;
}
function detect_settings_difference(profile=null) {
    // check if the current settings differ from the given profile
    if (!profile) {  // if none provided, compare to the current profile
        profile = get_settings('profile')
    }
    let current_settings = copy_settings();
    let profile_settings = copy_settings(profile);
    return check_objects_different(current_settings, profile_settings)
}
function save_profile(profile=null) {
    if (!profile) {
        profile = get_settings('profile');
    }
    log("Saving Configuration Profile: "+profile);

    let profiles = get_settings('profiles');
    const savedSettings = stripTimelineStateFromProfileSettings(copy_settings());

    profiles[profile] = savedSettings;
    set_settings('profiles', profiles);

    check_preset_valid()
    update_save_icon_highlight();
}
function load_profile(profile=null) {
    let current_profile = get_settings('profile')
    if (!profile) {
        profile = current_profile
    }

    let settings = copy_settings(profile);
    if (!settings) {
        error("Profile not found: "+profile);
        return;
    }

    settings = stripTimelineStateFromProfileSettings(normalizeImportedProfile(settings));

    let profiles = get_settings('profiles', true) || {};
    if (profiles[profile]) {
        profiles[profile] = structuredClone(settings);
        set_settings('profiles', profiles);
    }

    log("Loading Configuration Profile: "+profile);

    // Profile load changes behavior/config only.
    // It must not touch timeline_text, timeline_presets, or selected_timeline_preset.
Object.assign(extension_settings[MODULE_NAME], settings);
    set_settings('profile', profile);
    if (get_settings("notify_on_profile_switch") && current_profile !== profile) {
        toast(`Switched to profile "${profile}"`, 'info')
    }
    refresh_settings();
}
function export_profile(profile=null) {
    // export a settings profile
    if (!profile) {  // if none provided, reload the current profile
        profile = get_settings('profile')
    }

    let settings = copy_settings(profile);  // copy the settings from the profile
    if (!settings) {
        error("Profile not found: "+profile);
        return;
    }

    log("Exporting Configuration Profile: "+profile);
    const data = JSON.stringify(settings, null, 4);
    download(data, `${profile}.json`, 'application/json');
}
async function import_profile(e) {
    let file = e.target.files[0];
    if (!file) {
        return;
    }

    const name = file.name.replace('.json', '')
    const data = await parseJsonFile(file);
    const normalized = normalizeImportedProfile(data);

    let profiles = get_settings('profiles');
    profiles[name] = normalized;
    set_settings('profiles', profiles);

    toast(`Aspect: Destinia profile \"${name}\" imported`, 'success')
    e.target.value = null;

    refresh_settings_for_profile_section()
}
async function rename_profile() {
    // Rename the current profile via user input
    let ctx = getContext();
    let old_name = get_settings('profile');
    let new_name = await ctx.Popup.show.input("Rename Configuration Profile", `Enter a new name:`, old_name);

    // if it's the same name or none provided, do nothing
    if (!new_name || old_name === new_name) {
        return;
    }

    let profiles = get_settings('profiles');

    // check if the new name already exists
    if (profiles[new_name]) {
        error(`Profile [${new_name}] already exists`);
        return;
    }

    // rename the profile
    profiles[new_name] = profiles[old_name];
    delete profiles[old_name];
    set_settings('profiles', profiles);
    set_settings('profile', new_name);  // set the current profile to the new name

    // if any characters are using the old profile, update it to the new name
    let character_profiles = get_settings('character_profiles');
    for (let [character_key, character_profile] of Object.entries(character_profiles)) {
        if (character_profile === old_name) {
            character_profiles[character_key] = new_name;
        }
    }

    log(`Renamed profile [${old_name}] to [${new_name}]`);
    refresh_settings_for_profile_section()
}
function new_profile() {
    registerKnownChat();
    let profiles = get_settings('profiles');
    let profile = getChatLabel() || 'New Profile';
    let i = 1;
    while (profiles[profile]) {
        profile = `${getChatLabel() || 'New Profile'} ${i}`;
        i++;
    }
    save_profile(profile);
    load_profile(profile);
    set_chat_profile(profile);
}
function duplicate_profile() {
    const currentProfile = get_settings('profile');
    const profiles = get_settings('profiles', true) || {};
    const source = profiles[currentProfile];
    if (!source) return;

    let duplicateName = `${currentProfile} Copy`;
    let i = 2;
    while (profiles[duplicateName]) {
        duplicateName = `${currentProfile} Copy ${i}`;
        i++;
    }

    profiles[duplicateName] = normalizeImportedProfile(source);
    set_settings('profiles', profiles);
    load_profile(duplicateName);
}
async function delete_profile() {
    const profileNames = Object.keys(get_settings('profiles') || {});
    if (profileNames.length === 1) {
        error("Cannot delete your last profile");
        return;
    }
    let profile = get_settings('profile');
    let profiles = get_settings('profiles');

    let result = await getContext().Popup.show.confirm(`Permanently delete profile: "${profile}"`, "", {okButton: 'Delete', cancelButton: 'Cancel'});
    if (!result) {
        return
    }

    // delete the profile
    delete profiles[profile];
    set_settings('profiles', profiles);
    toast(`Deleted Configuration Profile: \"${profile}\"`, "success");

    // remove any references to this profile connected to characters or chats
    let character_profiles = get_settings('character_profiles')
    let chat_profiles = get_settings('chat_profiles')
    if (character_profiles !== undefined) {
        for (let [id, name] of Object.entries(character_profiles)) {
            if (name === profile) {
                delete character_profiles[id]
            }
        }
        set_settings('character_profiles', character_profiles)
    }

    if (chat_profiles !== undefined) {
        for (let [id, name] of Object.entries(chat_profiles)) {
            if (name === profile) {
                delete chat_profiles[id]
            }
        }
        set_settings('chat_profiles', chat_profiles)
    }

    auto_load_profile()
}
function toggle_character_profile() {
    // Toggle whether the current profile is set to the default for the current character
    let key = get_current_character_identifier();  // uniquely identify the current character or group chat
    debug("Character Key: "+key)
    if (!key) {  // no character selected
        return;
    }

    // current profile
    let profile = get_settings('profile');

    // if the character profile is already set to the current profile, unset it.
    // otherwise, set it to the current profile.
    set_character_profile(key, profile === get_character_profile() ? null : profile);
}
function toggle_chat_profile() {
    // Toggle whether the current profile is set to the default for the current chat
    let profile = get_settings('profile');  // current profile

    // if the chat profile is already set to the current profile, unset it.
    // otherwise, set it to the current profile.
    set_chat_profile(profile === get_chat_profile() ? null : profile);
}
function get_character_profile(key) {
    // Get the profile for a given character
    if (!key) {  // if none given, assume the current character
        key = get_current_character_identifier();
    }
    let character_profiles = get_settings('character_profiles');
    return character_profiles[key]
}
function set_character_profile(key, profile=null) {
    // Set the profile for a given character (or unset it if no profile provided)
    let character_profiles = get_settings('character_profiles');

    if (profile) {
        character_profiles[key] = profile;
        log(`Set character [${key}] to use profile [${profile}]`);
    } else {
        delete character_profiles[key];
        log(`Unset character [${key}] default profile`);
    }

    set_settings('character_profiles', character_profiles);
    refresh_settings_for_profile_section()
}
function get_chat_profile() {
    // Get the profile for the current chat
    return get_chat_metadata('profile');
}
function set_chat_profile(profile=null) {
    const chatProfiles = get_settings('chat_profiles', true) || {};
    const key = getChatKey();
    if (profile) {
        chatProfiles[key] = profile;
        set_chat_metadata('profile', profile)
        log(`Set chat to use profile [${profile}]`);
    } else {
        delete chatProfiles[key];
        set_chat_metadata('profile', null)
        log(`Unset chat default profile`);
    }
    set_settings('chat_profiles', chatProfiles);
    registerKnownChat();
    refresh_settings_for_profile_section()
}
function attach_profile_to_selected_known_chat(chatKey) {
    const selectedChatKey = String(chatKey || '').trim();
    const profile = get_settings('profile');
    const currentChatKey = getChatKey();
    const chatProfiles = get_settings('chat_profiles', true) || {};
    const previousCurrentChatProfile = chatProfiles[currentChatKey] || null;

    Object.keys(chatProfiles).forEach((key) => {
        if (chatProfiles[key] === profile) {
            delete chatProfiles[key];
        }
    });

    if (selectedChatKey) {
        chatProfiles[selectedChatKey] = profile;
        if (selectedChatKey === currentChatKey) {
            set_chat_metadata('profile', profile);
        } else if (previousCurrentChatProfile === profile) {
            set_chat_metadata('profile', null);
        }
        log(`Attached profile [${profile}] to known chat [${selectedChatKey}]`);
    } else {
        if (previousCurrentChatProfile === profile) {
            set_chat_metadata('profile', null);
        }
        log(`Cleared known-chat attachment for profile [${profile}]`);
    }

    set_settings('chat_profiles', chatProfiles);
    refresh_settings_for_profile_section();
    refresh_guidance();
}
function attach_current_chat_to_profile() {
    registerKnownChat();
    const profile = get_settings('profile');
    set_chat_profile(profile);
    refresh_guidance();
    toast(`Attached current chat to profile "${profile}"`, 'success');
}
function auto_load_profile() {
    // Load the settings profile for the current chat or character.
    // Profiles configure extension behavior only; they must not own Timeline JSON.
    let profile = get_chat_profile() || get_character_profile();
    load_profile(profile || 'Default');

    syncTimelineTextFromSelectedPreset({
        updateEditor: true,
        refreshGuidanceNow: true,
        refreshStatusNow: true,
    });
}



// UI functions
function get_message_div(index) {
    // given a message index, get the rendered message element for that index
    let div = $(`#chat .mes[mesid="${index}"]`);
    if (div.length === 0) {
        return null;
    }
    return div;
}
function buildDiagnosticDrawerShell(innerHtml = '', isLoading = false) {
    return `
        <div class="${state_div_class} ${css_message_div} aspect-destinia-diagnostic-container">
            <div class="aspect-destinia-diagnostic-drawer${isLoading ? ' aspect-destinia-diagnostic-loading' : ''}" data-collapsed="true">
                <div class="aspect-destinia-diagnostic-header">
                    <div class="aspect-destinia-diagnostic-line aspect-destinia-diagnostic-line-left"></div>
                    <button type="button" class="aspect-destinia-diagnostic-toggle" title="Toggle diagnostic visibility"><i class="fa-solid fa-hourglass-half"></i></button>
                    <div class="aspect-destinia-diagnostic-line aspect-destinia-diagnostic-line-right"></div>
                    <div class="aspect-destinia-diagnostic-timeline-label">Timeline (Diagnostics)</div>
                </div>
                <div class="aspect-destinia-diagnostic-box">
                    <div class="aspect-destinia-diagnostic-content">${innerHtml}</div>
                </div>
            </div>
        </div>
    `;
}
function getDiagnosticCheckboxSvg(isChecked) {
    return isChecked
        ? '<svg class="aspect-destinia-diagnostic-objective-icon-svg is-checked" aria-hidden="true" viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M4.7.8h14.6c2.43 0 4.4 1.97 4.4 4.4v14.6c0 2.43-1.97 4.4-4.4 4.4H4.7C2.27 24.2.3 22.23.3 19.8V5.2C.3 2.77 2.27.8 4.7.8zm0 3.2c-.55 0-1 .45-1 1v14.6c0 .55.45 1 1 1h14.6c.55 0 1-.45 1-1V5c0-.55-.45-1-1-1H4.7zm3.05 8.45 7.05-7.05 2.45 2.45-9.5 9.5-4.8-4.8 2.45-2.45 2.35 2.35z"></path></svg>'
        : '<svg class="aspect-destinia-diagnostic-objective-icon-svg is-unchecked" aria-hidden="true" viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M4.7.8h14.6c2.43 0 4.4 1.97 4.4 4.4v14.6c0 2.43-1.97 4.4-4.4 4.4H4.7C2.27 24.2.3 22.23.3 19.8V5.2C.3 2.77 2.27.8 4.7.8zm0 3.2c-.55 0-1 .45-1 1v14.6c0 .55.45 1 1 1h14.6c.55 0 1-.45 1-1V5c0-.55-.45-1-1-1H4.7z"></path></svg>';
}
function bindDiagnosticDrawerToggle($drawer) {
    const drawer = $drawer.find('.aspect-destinia-diagnostic-drawer');
    const toggle = $drawer.find('.aspect-destinia-diagnostic-toggle');
    toggle.off('click').on('click', () => {
        if (drawer.hasClass('aspect-destinia-diagnostic-loading')) return;
        const collapsed = drawer.attr('data-collapsed') === 'true';
        drawer.attr('data-collapsed', collapsed ? 'false' : 'true');
    });
    $drawer.find('.aspect-destinia-diagnostic-nav-button').off('click').on('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        const action = String($(this).data('plotAction') || '');
        const messageIndex = Number($(this).data('messageIndex'));
        if (action === 'first') {
            resetPlotPointToFirst();
        } else if (action === 'previous') {
            stepPlotPoint(-1);
        } else if (action === 'next') {
            stepPlotPoint(1);
        }
        const { current } = getCurrentPlotPoint();
        if (Number.isInteger(messageIndex) && messageIndex >= 0) {
            const chat = getContext().chat;
            const message = chat[messageIndex];
            if (message) {
                const diagnostic = get_data(message, 'diagnostic') || {};
                diagnostic.current_plot_title = current?.title || '';
                set_data(message, 'current_plot_title', current?.title || '');
                set_data(message, 'diagnostic', diagnostic);
                update_message_visuals(messageIndex, true);
                const refreshedDrawer = get_message_div(messageIndex)?.find('.aspect-destinia-diagnostic-drawer');
                refreshedDrawer?.attr('data-collapsed', 'false');
            }
        }
    });
}

function update_message_visuals(i, style=true, text=null) {
    const div_element = get_message_div(i);
    if (!div_element) return;

    div_element.find(`div.${state_div_class}`).remove();

    if (!get_settings('display_memories') || !chat_enabled()) return;

    const chat = getContext().chat;
    const message = chat[i];
    const diagnostic = get_data(message, 'diagnostic') || null;
    const currentPlot = diagnostic?.current_plot_title || get_data(message, 'current_plot_title') || '';
    const hasDiagnosticPayload = Boolean(diagnostic);

    const objectiveState = Array.isArray(diagnostic?.objective_completion) ? diagnostic.objective_completion : [];
    const objectiveLabels = Array.isArray(diagnostic?.objectives) ? diagnostic.objectives : [];
    const objectiveReasons = Array.isArray(diagnostic?.objective_reasons) ? diagnostic.objective_reasons : [];

    const transitionDiagnostic = diagnostic?.transition && typeof diagnostic.transition === 'object'
        ? diagnostic.transition
        : null;

    const hasTransitionPayload = Boolean(
        transitionDiagnostic
        && transitionDiagnostic.was_active
        && (
            transitionDiagnostic.source_title
            || transitionDiagnostic.destination_title
            || transitionDiagnostic.decision
            || transitionDiagnostic.reason
        )
    );

    const isLoadingDiagnostic = active_diagnostic_loading_index === i && !diagnostic;
    const isFinishingDiagnostic = finishing_diagnostic_index === i;
    const loadingProgress = isLoadingDiagnostic
        ? Math.max(0, Math.min(100, ((Date.now() - active_diagnostic_loading_started_at) / 12000) * 100))
        : 0;

    if (!hasDiagnosticPayload && !currentPlot && !objectiveState.length && !hasTransitionPayload && !text && !isLoadingDiagnostic) {
        return;
    }

    const liveCurrentPlot = getCurrentPlotPoint().current?.title || '';
    const message_element = div_element.find('div.mes_text');
    let rendered = text;

    if (!rendered) {
        const sections = [];
        const objectiveRows = [];

        if (objectiveState.length) {
            objectiveState.forEach((done, index) => {
                const label = objectiveLabels[index] || `Objective ${index + 1}`;
                const objectiveReason = objectiveReasons[index] || 'No objective-specific reason recorded.';

                objectiveRows.push(
                    `<div class="aspect-destinia-diagnostic-objective-entry">` +
                        `<div class="aspect-destinia-diagnostic-objective-titlebar">` +
                            `${getDiagnosticCheckboxSvg(done)}` +
                            `<span class="aspect-destinia-diagnostic-objective-titletext">Objective</span>` +
                        `</div>` +
                        `<div class="aspect-destinia-diagnostic-objective-item">` +
                            `<div class="aspect-destinia-diagnostic-objective-inline">${clean_string_for_html(label)}</div>` +
                        `</div>` +
                        `<div class="aspect-destinia-diagnostic-objective-reason">• <strong>Evaluation:</strong> ${clean_string_for_html(objectiveReason)}</div>` +
                    `</div>`
                );
            });
        }

        const statusParts = [];

        if (currentPlot) {
            statusParts.push(
                `<div class="aspect-destinia-diagnostic-section aspect-destinia-diagnostic-plot-point">` +
                    `<strong>Plot Point:</strong> ${clean_string_for_html(currentPlot)}` +
                `</div>`
            );
        }

        if (hasTransitionPayload) {
            const sourceTitle = transitionDiagnostic.source_title || 'Unknown Source';
            const destinationTitle = transitionDiagnostic.destination_title || 'Unknown Destination';
            const decision = transitionDiagnostic.completed || transitionDiagnostic.decision === 'complete'
                ? 'Complete'
                : 'In Progress';
            const confidence = Number.isFinite(Number(transitionDiagnostic.confidence))
                ? ` (${Math.round(Number(transitionDiagnostic.confidence) * 100)}% confidence)`
                : '';
            const reason = transitionDiagnostic.reason || 'No transition-specific reason recorded.';
            const guidance = transitionDiagnostic.transition_guidance || '';

            statusParts.push(
                `<div class="aspect-destinia-diagnostic-section aspect-destinia-diagnostic-plot-point">` +
                    `<strong>Transition:</strong> ${clean_string_for_html(sourceTitle)} → ${clean_string_for_html(destinationTitle)}` +
                `</div>`
            );

            statusParts.push(
                `<div class="aspect-destinia-diagnostic-section aspect-destinia-diagnostic-plot-point">` +
                    `<strong>Transition Status:</strong> ${clean_string_for_html(decision + confidence)}` +
                `</div>`
            );

            statusParts.push(
                `<div class="aspect-destinia-diagnostic-section aspect-destinia-diagnostic-plot-point">` +
                    `<strong>Transition Evaluation:</strong> ${clean_string_for_html(reason)}` +
                `</div>`
            );

            if (guidance) {
                statusParts.push(
                    `<div class="aspect-destinia-diagnostic-section aspect-destinia-diagnostic-plot-point">` +
                        `<strong>Transition Guidance:</strong> ${clean_string_for_html(guidance)}` +
                    `</div>`
                );
            }
        }

        if (objectiveRows.length) {
            statusParts.push(`<div class="aspect-destinia-diagnostic-objectives">${objectiveRows.join('')}</div>`);
        }

        if (statusParts.length) {
            sections.push(
                `<details class="aspect-destinia-diagnostic-section" open>` +
                    `<summary><strong>Status</strong></summary>` +
                    `${statusParts.join('')}` +
                `</details>`
            );
        }

        sections.push(
            `<details class="aspect-destinia-diagnostic-section" open>` +
                `<summary><strong>Controls</strong></summary>` +
                `<div class="aspect-destinia-diagnostic-section aspect-destinia-diagnostic-plot-point">` +
                    `<strong>Plot Point:</strong> ${clean_string_for_html(liveCurrentPlot || 'None')}` +
                `</div>` +
                `<div class="aspect-destinia-diagnostic-nav">` +
                    `<button type="button" class="menu_button aspect-destinia-diagnostic-nav-button" data-message-index="${i}" data-plot-action="first">First</button>` +
                    `<button type="button" class="menu_button aspect-destinia-diagnostic-nav-button" data-message-index="${i}" data-plot-action="previous">Previous</button>` +
                    `<button type="button" class="menu_button aspect-destinia-diagnostic-nav-button" data-message-index="${i}" data-plot-action="next">Next</button>` +
                `</div>` +
            `</details>`
        );

        rendered = sections.join('');
    }

    if (text) {
        rendered = messageFormatting(clean_string_for_html(rendered), null, false, false, -1);
    }

    const state_div = $(buildDiagnosticDrawerShell(rendered, isLoadingDiagnostic));
    const drawer = state_div.find('.aspect-destinia-diagnostic-drawer');

    if (isLoadingDiagnostic) {
        drawer.css('--aspect-destinia-diagnostic-progress', `${loadingProgress}%`);
    }

    if (isFinishingDiagnostic) {
        drawer.addClass('aspect-destinia-diagnostic-finishing');
    }

    bindDiagnosticDrawerToggle(state_div);
    message_element.after(state_div);
}

function update_all_message_visuals() {
    const chat = getContext().chat;
    const first_displayed_message_id = Number($('#chat').children('.mes').first().attr('mesid'));
    for (let i = chat.length - 1; i >= first_displayed_message_id; i--) {
        update_message_visuals(i, true);
    }
}
function display_injection_preview() {
    let text = refresh_guidance();
    text = `...\n\n${text}\n\n...`;
    display_text_modal('Destinia Guidance Preview', text);
}

async function display_text_modal(title, text="") {
    // Display a modal with the given title and text
    // replace newlines in text with <br> for HTML
    let ctx = getContext();
    text = text.replace(/\n/g, '<br>');
    let html = `<h3>${title}</h3><div style="text-align: left; overflow: auto;">${text}</div>`
    let popup = new ctx.Popup(html, ctx.POPUP_TYPE.TEXT, undefined, {okButton: 'Close', allowVerticalScrolling: true, wider: true});
    await popup.show()
}
async function get_user_setting_text_input(key, title, description="") {
    // Display a modal with a text area input, populated with a given setting value
    let value = get_settings(key) ?? '';

    title = `
<h3>${title}</h3>
<p>${description}</p>
`

    let restore_button = {  // don't specify "result" key do not close the popup
        text: 'Restore Default',
        appendAtEnd: true,
        action: () => { // fill the input with the default value
            popup.mainInput.value = default_settings[key] ?? '';
        }
    }
    let ctx = getContext();
    let popup = new ctx.Popup(title, ctx.POPUP_TYPE.INPUT, value, {rows: 20, customButtons: [restore_button], wider: true});

    add_i18n($(popup.content))  // translate any content

    // Now remove the ".result-control" class to prevent it from submitting when you hit enter.
    popup.mainInput.classList.remove('result-control');

    let input = await popup.show();
    if (input) {
        set_settings(key, input);
        refresh_settings_for_structure()
        refresh_guidance()
    }
}
// Interfaces
// Message functions
function set_data(message, key, value) {
    // store information on the message object
    if (!message.extra) {
        message.extra = {};
    }
    if (!message.extra[MODULE_NAME]) {
        message.extra[MODULE_NAME] = {};
    }

    message.extra[MODULE_NAME][key] = value;

    // Also save on the current swipe info if present
    let swipe_index = message.swipe_id
    if (swipe_index && message.swipe_info?.[swipe_index]) {
        if (!message.swipe_info[swipe_index].extra) {
            message.swipe_info[swipe_index].extra = {};
        }
        message.swipe_info[swipe_index].extra[MODULE_NAME] = structuredClone(message.extra[MODULE_NAME])
    }

    saveChatDebounced();
}
function get_data(message, key) {
    // get information from the message object
    return message?.extra?.[MODULE_NAME]?.[key];
}
function get_character_key(message) {
    // get the unique identifier of the character that sent a message
    return message.original_avatar
}
function get_short_guidance() {
    return buildDestiniaGuidance();
}
function refresh_guidance() {
    const context = getContext();
    let promptText = get_short_guidance();
    const shortTermPosition = get_settings('guidance_position');

    if (main_api !== 'openai' && shortTermPosition !== extension_prompt_types.IN_CHAT && promptText.length) {
        promptText = formatInstructModeChat('', promptText, false, true);
    }

    trace_debug('RefreshGuidance', {
        currentPlotPoint: getCurrentPlotPoint().current?.id || '',
        position: shortTermPosition,
        depth: get_settings('guidance_depth'),
        role: get_settings('guidance_role'),
        scan: get_settings('guidance_scan'),
        promptLength: promptText.length,
        promptPreview: promptText.slice(0, 300),
    });

    if (typeof context.setExtensionPrompt === 'function') {
        context.setExtensionPrompt(
            MODULE_NAME,
            promptText,
            shortTermPosition,
            get_settings('guidance_depth'),
            get_settings('guidance_scan'),
            get_settings('guidance_role')
        );
    }

    return promptText;
}
const refresh_guidance_debounced = debounce(() => refresh_guidance(), debounce_timeout.relaxed);

// Event handling
var last_message_swiped = null  // if an index, that was the last message swiped
var last_message = null // if an index, that was the last message sent
async function on_chat_event(event=null, data=null) {
    // When the chat is updated, refresh Destinia guidance/state as needed.
    debug("Chat updated:", event, data)

    const context = getContext();
    let index = data

    switch (event) {
        case 'chat_changed':  // chat was changed
            last_message_swiped = null;
            last_message = null;
            registerKnownChat();
            auto_load_profile();  // load the profile for the current chat or character
            refresh_guidance();  // refresh the active guidance state
            if (context?.chat?.length) {
                scrollChatToBottom();  // scroll to the bottom of the chat (area is added due to memories)
            }
            break;

        case 'message_deleted':   // message was deleted
            last_message_swiped = null;
            if (index === last_message) last_message -= 1;  // If the last message was deleted
            if (!chat_enabled()) break;  // if chat is disabled, do nothing
            debug("Message deleted, refreshing guidance")
            refresh_guidance();
            break;

        case 'before_message':
            if (!chat_enabled()) break;
            refresh_guidance();
            break;

        case 'user_message':
            last_message_swiped = null;
            last_message = null;
            if (!chat_enabled()) break;
            if (selected_group && getMessagesEvaluatedMode() === 'user') {
                pendingGroupUserEvaluationIndex = typeof index === 'number' ? index : context.chat.length - 1;
                break;
            }
            if (getMessagesEvaluatedMode() === 'user') {
                const userMessage = context.chat?.[typeof index === 'number' ? index : context.chat.length - 1] || context.chat?.[context.chat.length - 1] || null;
                await scheduleDestiniaEvaluation(userMessage);
            }
            refresh_guidance();
            break;

        case 'char_message':
            if (!chat_enabled()) break;
            if (!context.groupId && context.characterId === undefined) break;
            if (streamingProcessor && !streamingProcessor.isFinished) break;
            last_message_swiped = null;
            last_message = index;
            if (!selected_group) {
                const mode = getMessagesEvaluatedMode();
                if (mode === 'assistant' || mode === 'both') {
                    const assistantMessage = context.chat?.[index] || null;
                    await scheduleDestiniaEvaluation(assistantMessage);
                }
            }
            refresh_guidance();
            break;

        case 'message_edited':
            last_message_swiped = null;
            if (!chat_enabled()) break;
            refresh_guidance();
            break;

        case 'message_swiped':
            last_message_swiped = index;
            if (!chat_enabled()) break;
            refresh_guidance();
            scrollChatToBottom();
            break;

        default:
            if (!chat_enabled()) break;  // if chat is disabled, do nothing
            debug(`Unknown event: "${event}", refreshing guidance`)
            refresh_guidance();
    }
}


// UI initialization
function initialize_settings_listeners() {
    log("Initializing settings listeners")

    // Trigger profile changes
    bind_setting('#profile', 'profile', 'text', () => {
    load_profile();

    syncTimelineTextFromSelectedPreset({
        updateEditor: true,
        refreshGuidanceNow: true,
        refreshStatusNow: true,
    });
}, false);
    bind_function('#save_profile', () => save_profile(), false);
    bind_function('#rename_profile', () => rename_profile(), false)
    bind_function('#new_profile', new_profile, false);
    bind_function('#duplicate_profile', duplicate_profile, false);
    bind_function('#delete_profile', delete_profile, false);

    bind_function('#export_profile', () => export_profile(), false)
    bind_function('#import_profile', (e) => {
        $(e.target).parent().find("#import_file").click()
    }, false)
    bind_function('#import_file', async (e) => await import_profile(e), false)

    bind_function('#chat_profile_select', (event) => {
        attach_profile_to_selected_known_chat($(event.target).val());
    }, false);
    bind_setting('#notify_on_profile_switch', 'notify_on_profile_switch', 'boolean')

    bind_function('#toggle_chat_guidance', () => attach_current_chat_to_profile(), false);
    bind_function('#clear_chat', clearCurrentChatMessages, false);
    bind_function('#fresh_reset_extension', freshResetExtensionState, false);
    bind_function('#download_debug_log', downloadDebugLog, false);

    bind_setting('#dest_enabled', 'dest_enabled', 'boolean');
    bind_setting('#strictness', 'strictness', 'number');
    bind_setting('#pacing_bias', 'pacing_bias', 'number');
    bind_setting('#objective_auto_advance_threshold', 'objective_auto_advance_threshold', 'number');
    bind_setting('#objective_evaluation_method', 'objective_evaluation_method', 'text');
    bind_setting('#evaluation_cooldown_enabled', 'evaluation_cooldown_enabled', 'boolean');
    bind_setting('#evaluation_cooldown_seconds', 'evaluation_cooldown_seconds', 'number');
    bind_setting('#evaluation_delay_seconds', 'evaluation_delay_seconds', 'number');
    bind_setting('#intent_window', 'intent_window', 'number');
    bind_setting('#progression_rule', 'progression_rule', 'text');
    bind_setting('#foreshadow_next_plot_point', 'foreshadow_next_plot_point', 'boolean');
    bind_setting('input[name="messages_evaluated"]', 'messages_evaluated', 'text');
    bind_setting('#timeline_deviation_allowed', 'timeline_deviation_allowed', 'boolean');
    bind_setting('#auto_resolve_deviation', 'auto_resolve_deviation', 'boolean');
    bind_setting('#detach_enabled', 'detach_enabled', 'boolean');
    bind_setting('#detach_instruction', 'detach_instruction', 'text');
    initialize_connection_profile_dropdown();
    bind_setting('#evaluator_preset', 'evaluator_preset', 'text');
    bindTimelineEditor();
    bind_setting('#guidance_intro', 'guidance_intro', 'text');
    bind_setting('#guidance_principles', 'guidance_principles', 'text');
    bind_setting('#current_plot_point_template', 'current_plot_point_template', 'text');
    bind_setting('#next_plot_point_template', 'next_plot_point_template', 'text');
    bind_setting('#transition_template', 'transition_template', 'text');
    bind_setting('#objective_guidance_template', 'objective_guidance_template', 'text');
    bind_setting('#intent_progression_rule', 'intent_progression_rule', 'text');
    bind_setting('#progression_instruction', 'progression_instruction', 'text');
    bind_setting('#pacing_instruction', 'pacing_instruction', 'text');
    bind_setting('#objective_completion_guidance', 'objective_completion_guidance', 'text');
    bind_setting('#foreshadowing_template', 'foreshadowing_template', 'text');
    bind_setting('#timeline_deviation_instruction', 'timeline_deviation_instruction', 'text');
    bind_setting('#auto_resolve_deviation_instruction', 'auto_resolve_deviation_instruction', 'text');
    bind_setting('#guidance_outro', 'guidance_outro', 'text');
    bind_setting('#evaluator_prompt', 'evaluator_prompt', 'text');


    bindTextAreaLauncher('#guidance_intro', 'guidance_intro', 'Injection Intro');
    bindTextAreaLauncher('#guidance_principles', 'guidance_principles', 'Guidance Principles');
    bindTextAreaLauncher('#current_plot_point_template', 'current_plot_point_template', 'Current Plot Point Template');
    bindTextAreaLauncher('#next_plot_point_template', 'next_plot_point_template', 'Next Plot Point Template');
    bindTextAreaLauncher('#transition_template', 'transition_template', 'Transition Template');
    bindTextAreaLauncher('#objective_guidance_template', 'objective_guidance_template', 'Objective Guidance Template');
    bindTextAreaLauncher('#intent_progression_rule', 'intent_progression_rule', 'Intent Progression Rule');
    bindTextAreaLauncher('#progression_instruction', 'progression_instruction', 'Progression Instruction');
    bindTextAreaLauncher('#pacing_instruction', 'pacing_instruction', 'Pacing Instruction');
    bindTextAreaLauncher('#objective_completion_guidance', 'objective_completion_guidance', 'Objective Completion Guidance');
    bindTextAreaLauncher('#foreshadowing_template', 'foreshadowing_template', 'Foreshadowing Template');
    bindTextAreaLauncher('#timeline_deviation_instruction', 'timeline_deviation_instruction', 'Timeline Deviation Instruction');
    bindTextAreaLauncher('#auto_resolve_deviation_instruction', 'auto_resolve_deviation_instruction', 'Auto-Resolve Deviation Instruction');
    bindTextAreaLauncher('#guidance_outro', 'guidance_outro', 'Guidance Outro');
    bindTextAreaLauncher('#evaluator_prompt', 'evaluator_prompt', 'Evaluator Prompt');

bind_setting('#timeline_preset', 'selected_timeline_preset', 'text', () => {
    syncTimelineTextFromSelectedPreset({
        updateEditor: true,
        refreshGuidanceNow: true,
        refreshStatusNow: true,
    });
});
    bind_function('#timeline_preset_create', () => createTimelinePreset(false), false);
    bind_function('#timeline_preset_save', saveSelectedTimelinePreset, false);
    bind_function('#timeline_preset_rename', renameSelectedTimelinePreset, false);
    bind_function('#timeline_preset_duplicate', () => createTimelinePreset(true), false);
    bind_function('#timeline_preset_delete', deleteSelectedTimelinePreset, false);
    bind_function('#timeline_export', exportTimelineToFile, false);
    bind_function('#timeline_import', () => $(`.${settings_content_class} #timeline_import_file`).click(), false);
    bind_function('#timeline_import_file', async (e) => await importTimelineFromFile(e), false);
    bind_function('#plot_point_first', resetPlotPointToFirst, false);
    bind_function('#plot_point_prev', () => stepPlotPoint(-1), false);
    bind_function('#plot_point_next', () => stepPlotPoint(1), false);

    bind_setting('input[name="guidance_position"]', 'guidance_position', 'number');
    bind_setting('#guidance_depth', 'guidance_depth', 'number');
    bind_setting('#guidance_role', 'guidance_role');
    bind_setting('#guidance_scan', 'guidance_scan', 'boolean');

    bind_setting('#debug_mode', 'debug_mode', 'boolean');
    bind_setting('#display_memories', 'display_memories', 'boolean');

    refresh_settings();
}
function initialize_slash_commands() {
    let ctx = getContext()
    let SlashCommandParser = ctx.SlashCommandParser
    let SlashCommand = ctx.SlashCommand
    let SlashCommandArgument = ctx.SlashCommandArgument
    let SlashCommandNamedArgument = ctx.SlashCommandNamedArgument
    let ARGUMENT_TYPE = ctx.ARGUMENT_TYPE

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'ad-debug',
        aliases: ['aspect-destinia-debug'],
        helpString: 'Log Aspect: Destinia extension state to console.',
        callback: () => {
            log(getContext());
            log(extension_settings[MODULE_NAME]);
            log(chat_metadata);
            return '';
        },
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'ad-hard-reset',
        aliases: ['aspect-destinia-hard-reset'],
        helpString: 'WARNING: Hard reset all settings for Aspect: Destinia. All config profiles will be deleted.',
        callback: () => {
            hard_reset_settings();
            refresh_settings();
            refresh_guidance();
            return '';
        },
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'ad-enabled',
        aliases: ['aspect-destinia-enabled'],
        helpString: 'Return whether Aspect: Destinia is enabled in the current chat.',
        callback: () => String(chat_enabled()),
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'ad-toggle',
        aliases: ['aspect-destinia-toggle'],
        helpString: 'Change whether Aspect: Destinia is enabled for the current chat. If no state is provided, it will toggle the current state.',
        callback: (args, state) => {
            if (state === '') {
                state = null;
            } else {
                state = state === 'true';
            }
            toggle_chat_enabled(state);
            return '';
        },
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'Boolean value to set the guidance state',
                isRequired: false,
                typeList: ARGUMENT_TYPE.BOOLEAN,
            }),
        ],
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'ad-toggle-display',
        aliases: ['aspect-destinia-toggle-display'],
        helpString: 'Toggle the display of Destinia message state on the current profile.',
        callback: () => {
            $(`.${settings_content_class} #display_memories`).click();
            return '';
        },
    }));

}

function add_menu_button(text, fa_icon, callback, hover=null) {
    let $button = $(`
    <div class="list-group-item flex-container flexGap5 interactable" title="${hover ?? text}" tabindex="0">
        <i class="${fa_icon}"></i>
        <span>${text}</span>
    </div>
    `)

    let $extensions_menu = $('#extensionsMenu');
    if (!$extensions_menu.length) {
        error('Could not find the extensions menu');
    }

    $button.appendTo($extensions_menu)
    $button.click(() => callback());
}
async function rerun_chat_evaluation() {
    if (!chat_enabled() || !get_settings('dest_enabled')) {
        toast('Aspect: Destinia is disabled for this chat.', 'warning');
        return;
    }
    await scheduleDestiniaEvaluation(getGroupEvaluationTargetMessage());
    refresh_guidance();
    update_all_message_visuals();
}
function initialize_menu_buttons() {
    add_menu_button(t`Toggle Guidance`, "fa-solid fa-route", toggle_chat_enabled, t`Toggle Aspect: Destinia guidance for the current chat.`)
    add_menu_button(t`Rerun Evaluation`, "fa-solid fa-rotate-right", rerun_chat_evaluation, t`Rerun Aspect: Destinia evaluation for the current chat and refresh the diagnostic message.`)
}


// Entry point
jQuery(async function () {
    log(`Loading extension...`)

    // Read version from manifest.json
    const manifest = await get_manifest();
    const VERSION = manifest.version;
    log(`Version: ${VERSION}`)

    // Load settings
    initialize_settings();

    // load settings html
    await load_settings_html();

    // Timeline JSON is preset-owned, not profile-owned.
    // After settings and HTML exist, mirror the selected timeline preset into timeline_text
    // and the Timeline JSON editor field.
    syncTimelineTextFromSelectedPreset({
        updateEditor: true,
        refreshGuidanceNow: false,
        refreshStatusNow: false,
    });

    // initialize UI
    initialize_settings_listeners();
    initialize_slash_commands();
    initialize_menu_buttons();
    add_i18n()

    // ST event listeners
    let ctx = getContext();
    let eventSource = ctx.eventSource;
    let event_types = ctx.event_types;
    eventSource.on(event_types.CONNECTION_PROFILE_LOADED, async () => {
    await apply_structural_settings_surfaces();
    apply_common_settings_surfaces();
});
    eventSource.makeLast(event_types.CHARACTER_MESSAGE_RENDERED, (id) => on_chat_event('char_message', id));
    eventSource.on(event_types.USER_MESSAGE_RENDERED, (id) => on_chat_event('user_message', id));
    eventSource.on(event_types.GROUP_WRAPPER_FINISHED, () => {
        if (!chat_enabled()) return;
        const mode = getMessagesEvaluatedMode();
        if (mode === 'assistant' || mode === 'both') {
            scheduleDestiniaEvaluation(getGroupEvaluationTargetMessage());
        } else if (mode === 'user' && pendingGroupUserEvaluationIndex !== null) {
            scheduleDestiniaEvaluation(getGroupEvaluationTargetMessage());
        }
        refresh_guidance();
    });
    eventSource.on(event_types.MESSAGE_DELETED, (id) => on_chat_event('message_deleted', id));
    eventSource.on(event_types.MESSAGE_EDITED, (id) => on_chat_event('message_edited', id));
    eventSource.on(event_types.MESSAGE_SWIPED, (id) => on_chat_event('message_swiped', id));
    eventSource.on(event_types.CHAT_CHANGED, () => on_chat_event('chat_changed'));
    eventSource.on(event_types.MORE_MESSAGES_LOADED, refresh_guidance)
    eventSource.on(event_types.SETTINGS_UPDATED, async () => {
    await apply_structural_settings_surfaces();
    apply_common_settings_surfaces();
});  // refresh extension settings when ST settings change without forcing a full panel rewrite
    eventSource.on(event_types.GENERATION_STARTED, (type, stuff, dry) => on_chat_event('before_message', {'type': type, 'dry': dry}))

});
