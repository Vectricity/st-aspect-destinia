const MODULE_ID = 'st-aspect-destinia';
const MODULE_NAME = 'Aspect: Destinia';
const ROOT_ID = 'aspect_destinia_root';
const EXTENSION_PROMPT_KEY = 'aspect_destinia_prompt';
// Prefer evaluator-model checks first; only fall back to local heuristics when backend limitations occur.
let remoteIntentEvalDisabled = false;
let uiBusyCounter = 0;
let busyIndicatorShownAt = 0;


const DEFAULT_TIMELINE_TEMPLATE = {
    storyTitle: 'Your Story Title',
    systemStyle: 'Describe the desired tone, canon strictness, pacing, and roleplay style here.',
    progressionNotes: 'Optional global notes about how this story should unfold.',
    plotPoints: [
        {
            id: 'plot-point-1',
            title: 'Opening Situation',
            summary: 'Describe the current narrative stage and what the cast is generally dealing with.',
            objectives: [
                { text: 'Establish the setting and immediate situation.', completed: false },
                { text: 'Surface the main character motivations that matter for this phase.', completed: false },
                { text: 'Allow the user to meaningfully interact with the current story situation.', completed: false }
            ],
            completionHints: [
                'The current situation has clearly played out.',
                'The user is signaling movement toward the next development.',
                'The scene feels narratively ready to transition.'
            ],
            steeringPrompt: 'Keep the narrative focused on the opening situation while remaining flexible to the user’s choices.',
            transitionGuidance: 'Before moving into the escalation, explicitly show what changed in-scene that caused the transition and introduce any newly relevant elements.',
            pace: 'medium',
            delayable: true
        },
        {
            id: 'plot-point-2',
            title: 'First Escalation',
            summary: 'Describe the next major development or escalation.',
            objectives: [
                { text: 'Introduce the next complication or escalation naturally.', completed: false },
                { text: 'Preserve continuity from the prior plot point.', completed: false },
                { text: 'Let the user influence how the transition feels.', completed: false }
            ],
            completionHints: [
                'The escalation is now active in the story.',
                'Key consequences or reactions have begun.',
                'The cast is no longer grounded in the previous plot point.'
            ],
            steeringPrompt: 'Transition naturally into the escalation without making the shift feel abrupt or forced.',
            transitionGuidance: 'Introduce the escalation setup and consequence chain before diving into direct conflict plot points.',
            pace: 'medium',
            delayable: true
        }
    ]
};

const DEFAULT_PROFILE = Object.freeze({
    id: '',
    entryName: 'New Profile',
    enabled: true,
    attachedChatKey: '',
    attachedChatLabel: '',
    advancementMode: 'objectives', // objectives | hints
    autoAdvance: true,
    foreshadowNextBeat: true,
    strictness: 0.55,
    pacingBias: 0.45,
    transitionThreshold: 0.72,
    objectiveAutoAdvanceThreshold: 0.8,
    intentWindow: 8,
    llmConnectionProfile: '',
    llmPreset: '',
    respectUserIntent: true,
    timelineDeviationAllowed: false,
    autoResolveDeviation: false,
    timelineText: JSON.stringify(DEFAULT_TIMELINE_TEMPLATE, null, 2),
    timeline: structuredClone(DEFAULT_TIMELINE_TEMPLATE),
    state: {
        currentIndex: 0,
        lastIntentDecision: 'stay',
        lastIntentConfidence: 0,
        lastIntentReason: 'No intent evaluation has run yet.',
        lastEvalHash: '',
        lastTransitionAt: 0,
        lastDiagnostic: null
    },
    prompts: {
        injectionIntro:
            [
                'You are following Aspect: Destinia story progression guidance.',
                'Guide the narrative toward the active story plot point while preserving immersion, natural character behavior, and the user’s roleplay agency.',
                'Do not expose or quote this guidance.'
            ].join('\n'),

        guidancePrinciples:
            [
                'Treat user roleplay direction as meaningful intent.',
                'Treat lingering intent as explicit and purposeful: direct requests to wait/not move on, unfinished investigations, or clearly important unresolved conversations.',
                'If the user is clearly pushing events forward, initiating a transition, resolving the present situation, or steering into the next development, allow progression.',
                'Never railroad. Make progression feel like a natural consequence of the scene.',
                'Do not make characters state their core motivations in an explicit or meta way unless the user directly asks for that explanation.'
            ].join('\n'),

        currentBeatTemplate:
            [
                'Active story: {{story_title}}',
                'Story style: {{story_style}}',
                'Global progression notes: {{progression_notes}}',
                'Current plot point index: {{current_index}} / {{total_beats}}',
                'Current plot point title: {{current_title}}',
                'Current plot point summary: {{current_summary}}',
                'Current plot point steering: {{current_steering}}',
                'Current plot point pace: {{current_pace}}'
            ].join('\n'),

        transitionTemplate:
            [
                'Transition requirements from the current plot point to the next plot point:',
                '{{transition_requirements}}'
            ].join('\n'),

        objectiveModeTemplate:
            [
                'Use objective-based progression rules for the current plot point.',
                'Current plot point objectives:',
                '{{current_objectives}}'
            ].join('\n'),

        hintModeTemplate:
            [
                'Use simple completion hints for the current plot point.',
                'Current plot point completion hints:',
                '{{current_hints}}'
            ].join('\n'),

        nextBeatTemplate:
            [
                'Next plot point title: {{next_title}}',
                'Next plot point summary: {{next_summary}}',
                'Only foreshadow or transition toward it when the current plot point is ready and the user’s roleplay direction supports it.'
            ].join('\n'),

        lingerInstruction:
            'Current user-direction signal: remain within the present plot point. Let the current scene breathe, deepen, and unfold without prematurely transitioning.',

        advanceInstruction:
            'Current user-direction signal: allow movement toward the next plot point. Transition smoothly through natural consequences rather than abrupt narration.',

        pacingInstruction:
            [
                'Strictness value: {{strictness}}',
                'Pacing bias value: {{pacing_bias}}',
                'Lower strictness means more freedom and softer canon guidance.',
                'Higher strictness means stronger canon alignment while still respecting user agency.',
                'Lower pacing bias means slower development; higher pacing bias means more visible narrative momentum.'
            ].join('\n'),

        objectiveCompletionGuidance:
            'Mark objective_completion as true when the user meaningfully demonstrates progress equivalent to an objective, even if phrasing is paraphrased, implied, or distributed across recent messages. Keep false when evidence is weak or absent.',

        evaluatorPrompt:
            [
                'You are evaluating roleplay progression for a story timeline controller.',
                'Read the recent chat and determine whether the USER is signaling that the story should stay on the current plot point or may transition toward the next plot point.',
                'Only mark objectives complete when the USER meaningfully demonstrates progress. Do not mark completion based only on assistant/NPC narration or dialogue.',
                'Only mark user_wants_to_linger as true when the user explicitly asks to delay progression, is clearly still working an unfinished in-plot-point task, or is engaged in an important unresolved conversation. Ordinary banter or casual dialogue alone is not lingering intent.',
                '{{objective_completion_guidance}}',
                'Return ONLY valid JSON with these keys:',
                '{',
                '  "decision": "stay" | "advance",',
                '  "confidence": 0.0,',
                '  "reason": "short explanation",',
                '  "beat_complete": [true, false],',
                '  "user_wants_to_linger": [true, false],',
                '  "objective_completion": [true, false]',
                '}',
                'Use JSON booleans only (true/false), never quoted strings.',
                'Only set objective_completion items to true when the objective is complete based on the recent chat.',
                '',
                'Story title: {{story_title}}',
                'Current plot point: {{current_title}}',
                'Current plot point summary: {{current_summary}}',
                'Current plot point objectives: {{current_objectives_inline}}',
                'Current plot point objective completion booleans: {{current_objective_completion_inline}}',
                'Current plot point completion hints: {{current_hints_inline}}',
                'Next plot point: {{next_title}}',
                'Recent USER-only chat (primary evidence for objective completion):',
                '{{recent_user_chat}}',
                'Recent chat:',
                '{{recent_chat}}'
            ].join('\n')
    }
});

const DEFAULT_SETTINGS = Object.freeze({
    profiles: [],
    knownChats: [],
    ui: {
        selectedProfileId: ''
    }
});

const TEMPLATE_VALIDATION_RULES = Object.freeze({
    aspect_destinia_timeline: {
        type: 'json',
        label: 'Timeline JSON'
    },
    aspect_destinia_prompt_current: {
        type: 'template',
        label: 'Current Plot Point Template',
        requiredTokens: ['{{current_index}}', '{{total_beats}}', '{{current_title}}', '{{current_summary}}', '{{current_steering}}', '{{current_pace}}']
    },
    aspect_destinia_prompt_next: {
        type: 'template',
        label: 'Next Plot Point Template',
        requiredTokens: ['{{next_title}}', '{{next_summary}}']
    },
    aspect_destinia_prompt_transition: {
        type: 'template',
        label: 'Transition Template',
        requiredTokens: ['{{transition_requirements}}']
    },
    aspect_destinia_prompt_objectives: {
        type: 'template',
        label: 'Objective Mode Template',
        requiredTokens: ['{{current_objectives}}']
    },
    aspect_destinia_prompt_hints: {
        type: 'template',
        label: 'Hint Mode Template',
        requiredTokens: ['{{current_hints}}']
    },
    aspect_destinia_prompt_pacing: {
        type: 'template',
        label: 'Pacing Instruction',
        requiredTokens: ['{{strictness}}', '{{pacing_bias}}']
    },
    aspect_destinia_prompt_objective_guidance: {
        type: 'template',
        label: 'Objective Completion Guidance',
        requiredSnippets: ['objective_completion']
    },
    aspect_destinia_prompt_evaluator: {
        type: 'template',
        label: 'Evaluator Prompt',
        requiredTokens: ['{{objective_completion_guidance}}', '{{story_title}}', '{{current_title}}', '{{current_summary}}', '{{current_objectives_inline}}', '{{current_objective_completion_inline}}', '{{current_hints_inline}}', '{{next_title}}', '{{recent_user_chat}}', '{{recent_chat}}'],
        requiredSnippets: ['"decision"', '"confidence"', '"reason"', '"beat_complete"', '"user_wants_to_linger"', '"objective_completion"']
    }
});

function getCtx() {
    return SillyTavern.getContext();
}

function getExtensionSettings() {
    return getCtx().extensionSettings;
}

function saveSettings() {
    getCtx().saveSettingsDebounced();
}

async function saveChatMetadata() {
    if (typeof getCtx().saveMetadata === 'function') {
        await getCtx().saveMetadata();
    }
}

function mergeDeep(target, source) {
    const { lodash } = SillyTavern.libs;
    return lodash.merge(target, source);
}

function ensureSettings() {
    const extensionSettings = getExtensionSettings();
    extensionSettings[MODULE_ID] = mergeDeep(
        structuredClone(DEFAULT_SETTINGS),
        extensionSettings[MODULE_ID] || {}
    );

    if (!Array.isArray(extensionSettings[MODULE_ID].profiles)) {
        extensionSettings[MODULE_ID].profiles = [];
    }

    if (!Array.isArray(extensionSettings[MODULE_ID].knownChats)) {
        extensionSettings[MODULE_ID].knownChats = [];
    }

    return extensionSettings[MODULE_ID];
}

function makeId(prefix = 'destinia') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function getCharacterName(ctx) {
    try {
        if (ctx.groupId) return `Group ${ctx.groupId}`;
        if (typeof ctx.characterId === 'number' && ctx.characters?.[ctx.characterId]) {
            return ctx.characters[ctx.characterId].name || `Character ${ctx.characterId}`;
        }
    } catch {
        // ignore
    }
    return 'Unknown Chat';
}

function getChatKey(ctx = getCtx()) {
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

function getChatLabel(ctx = getCtx()) {
    const characterLabel = getCharacterName(ctx);
    const secondary = ctx.chatName || ctx.name2 || ctx.chatId || ctx.chatFileName || 'Current Chat';
    return `${characterLabel} — ${secondary}`;
}

function registerKnownChat() {
    const settings = ensureSettings();
    const key = getChatKey();
    const label = getChatLabel();
    const existing = settings.knownChats.find(x => x.key === key);

    if (existing) {
        existing.label = label;
        existing.lastSeen = Date.now();
    } else {
        settings.knownChats.push({
            key,
            label,
            lastSeen: Date.now()
        });
    }

    settings.knownChats.sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));
    saveSettings();
}

function getMetadataBucket() {
    const ctx = getCtx();
    if (!ctx.chatMetadata[MODULE_ID]) {
        ctx.chatMetadata[MODULE_ID] = {};
    }
    return ctx.chatMetadata[MODULE_ID];
}

function getProfiles() {
    return ensureSettings().profiles;
}

function getProfileById(profileId) {
    return getProfiles().find(p => p.id === profileId) || null;
}

function getSelectedProfileId() {
    return ensureSettings().ui.selectedProfileId || '';
}

function setSelectedProfileId(profileId) {
    ensureSettings().ui.selectedProfileId = profileId || '';
    saveSettings();
    updateExtensionPrompt();
}

function getLinkedProfileIdForCurrentChat() {
    const metadata = getMetadataBucket();
    if (metadata.profileId && getProfileById(metadata.profileId)) {
        return metadata.profileId;
    }

    const currentChatKey = getChatKey();
    const linkedByChat = getProfiles().find(p => p.attachedChatKey === currentChatKey);
    return linkedByChat?.id || '';
}

function getActiveProfile() {
    const linked = getLinkedProfileIdForCurrentChat();
    if (linked) return getProfileById(linked);

    const selected = getSelectedProfileId();
    if (selected) return getProfileById(selected);

    return null;
}

function getActiveTimeline(profile) {
    if (!profile) return null;
    if (!profile.timeline || !Array.isArray(profile.timeline.plotPoints)) {
        profile.timeline = safeParseTimeline(profile.timelineText) || structuredClone(DEFAULT_TIMELINE_TEMPLATE);
    }
    return profile.timeline;
}

function safeParseTimeline(text) {
    try {
        const parsed = typeof text === 'string' ? JSON.parse(text) : text;
        if (!parsed || !Array.isArray(parsed.plotPoints)) return null;
        return normalizeTimeline(parsed);
    } catch {
        return null;
    }
}

function getProfileDisplayName(profile) {
    const rawName = String(profile?.entryName || '').trim();
    if (!rawName || /^entry for\s+/i.test(rawName)) {
        return String(profile?.attachedChatLabel || '').trim() || 'Untitled Profile';
    }
    return rawName;
}

function hasBalancedTemplateDelimiters(value) {
    const text = String(value || '');
    const opens = (text.match(/\{\{/g) || []).length;
    const closes = (text.match(/\}\}/g) || []).length;
    return opens === closes;
}

function validateConfiguredField(fieldId) {
    const config = TEMPLATE_VALIDATION_RULES[fieldId];
    const el = document.getElementById(fieldId);
    if (!config || !el) return null;

    const value = String(el.value || '');
    if (config.type === 'json') {
        return safeParseTimeline(value) ? null : `${config.label} must be valid JSON and include plotPoints[].`;
    }

    if (!hasBalancedTemplateDelimiters(value)) {
        return `${config.label} has unmatched template delimiters.`;
    }

    const missingTokens = (config.requiredTokens || []).filter(token => !value.includes(token));
    if (missingTokens.length) {
        return `${config.label} is missing required placeholders: ${missingTokens.join(', ')}`;
    }

    const missingSnippets = (config.requiredSnippets || []).filter(snippet => !value.includes(snippet));
    if (missingSnippets.length) {
        return `${config.label} is missing required content expected by the current extension version.`;
    }

    return null;
}

function updateFieldValidationIndicators() {
    for (const fieldId of Object.keys(TEMPLATE_VALIDATION_RULES)) {
        const icon = document.querySelector(`.aspect-destinia-warning-icon[data-validation-for="${fieldId}"]`);
        if (!icon) continue;
        const message = validateConfiguredField(fieldId);
        icon.hidden = !message;
        icon.setAttribute('title', message || '');
        icon.setAttribute('aria-label', message || '');
    }
}

function getCurrentBeat(profile) {
    const timeline = getActiveTimeline(profile);
    const points = timeline?.plotPoints || [];
    const idx = Math.max(0, Math.min(profile.state.currentIndex || 0, Math.max(points.length - 1, 0)));
    profile.state.currentIndex = idx;
    return points[idx] || null;
}

function getNextBeat(profile) {
    const timeline = getActiveTimeline(profile);
    const points = timeline?.plotPoints || [];
    return points[(profile.state.currentIndex || 0) + 1] || null;
}

function formatList(items) {
    if (!Array.isArray(items) || items.length === 0) return '- none';
    return items.map(item => `- ${item}`).join('\n');
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

function normalizeTimeline(timeline) {
    if (!timeline || !Array.isArray(timeline.plotPoints)) return timeline;
    timeline.plotPoints = timeline.plotPoints.map(point => {
        const objectives = Array.isArray(point.objectives)
            ? point.objectives.map(normalizeObjectiveItem).filter(o => o.text)
            : [];
        const transitionGuidance = String(point.transitionGuidance || '').trim();
        return {
            ...point,
            objectives,
            transitionGuidance: transitionGuidance || 'Show the causal bridge from this plot point into the next plot point before the next plot point action fully begins.'
        };
    });
    return timeline;
}

function getObjectiveCompletionThreshold(profile) {
    return clamp01(Number(profile?.objectiveAutoAdvanceThreshold ?? 0.8));
}

function getSillyTavernConnectionProfiles() {
    const ctx = getCtx();
    const candidates = [
        ctx.connectionProfiles,
        ctx.connection_profiles,
        ctx.chatCompletionConnectionProfiles,
        ctx.chat_completion_connection_profiles,
        ctx.chatCompletionSettings?.profiles,
        ctx.chat_completion_settings?.profiles,
        ctx.chatCompletionConfig?.profiles,
        ctx.chat_completion_config?.profiles,
        ctx.extensionSettings?.connectionProfiles,
        ctx.extensionSettings?.connection_profiles,
        ctx.extensionSettings?.connections?.profiles,
        ...findNestedCollectionsByPathKeywords(ctx, ['connection', 'profile'])
    ].filter(Boolean);

    for (const candidate of candidates) {
        const arr = Array.isArray(candidate) ? candidate : Object.values(candidate || {});
        const profiles = arr
            .map((item) => {
                if (typeof item === 'string') return { value: item, label: item };
                const value = item?.id || item?.name || item?.value || item?.profile || item?.uid || item?.api_id;
                const label = item?.label || item?.name || item?.title || value;
                return value ? { value: String(value), label: String(label) } : null;
            })
            .filter(Boolean);
        if (profiles.length) return profiles;
    }

    return [];
}

function getSillyTavernChatPresets() {
    const ctx = getCtx();
    const candidates = [
        ctx.chatCompletionPresets,
        ctx.chat_completion_presets,
        ctx.chatCompletionSettings?.presets,
        ctx.chat_completion_settings?.presets,
        ctx.chatCompletionConfig?.presets,
        ctx.chat_completion_config?.presets,
        ctx.presets,
        ctx.presetList,
        ctx.extensionSettings?.chat_completion?.presets,
        ctx.extensionSettings?.presets,
        ctx.extensionSettings?.instruct?.presets,
        ...findNestedCollectionsByPathKeywords(ctx, ['preset'])
    ].filter(Boolean);

    for (const candidate of candidates) {
        const arr = Array.isArray(candidate) ? candidate : Object.values(candidate || {});
        const presets = arr
            .map((item) => {
                if (typeof item === 'string') return { value: item, label: item };
                const value = item?.id || item?.name || item?.value || item?.preset || item?.uid || item?.api_id;
                const label = item?.label || item?.name || item?.title || value;
                return value ? { value: String(value), label: String(label) } : null;
            })
            .filter(Boolean);
        if (presets.length) return presets;
    }

    return [];
}

function findNestedCollectionsByPathKeywords(root, requiredKeywords = []) {
    const matches = [];
    const seen = new WeakSet();
    const keywords = requiredKeywords.map(k => String(k).toLowerCase()).filter(Boolean);

    const walk = (value, path, depth) => {
        if (!value || typeof value !== 'object' || depth > 4 || seen.has(value)) return;
        seen.add(value);

        if (Array.isArray(value)) {
            if (value.length && pathMatches(path, keywords)) {
                matches.push(value);
            }
            for (const item of value) {
                walk(item, path, depth + 1);
            }
            return;
        }

        const entries = Object.entries(value);
        if (entries.length && pathMatches(path, keywords)) {
            matches.push(value);
        }

        for (const [key, nested] of entries) {
            walk(nested, [...path, key], depth + 1);
        }
    };

    walk(root, [], 0);
    return matches;
}

function pathMatches(path, keywords) {
    if (!keywords.length) return true;
    const loweredPath = path.map(part => String(part).toLowerCase());
    return keywords.every(keyword => loweredPath.some(part => part.includes(keyword)));
}

function renderEvaluatorModelOptions(profile) {
    const connectionSelect = $('#aspect_destinia_eval_connection');
    const presetSelect = $('#aspect_destinia_eval_preset');
    if (!connectionSelect.length || !presetSelect.length) return;

    const profiles = getSillyTavernConnectionProfiles();
    const presets = getSillyTavernChatPresets();

    connectionSelect.empty().append('<option value="">Use Active Connection Profile</option>');
    for (const item of profiles) {
        connectionSelect.append(`<option value="${escapeHtml(item.value)}">${escapeHtml(item.label)}</option>`);
    }
    connectionSelect.val(profile?.llmConnectionProfile || '');

    presetSelect.empty().append('<option value="">Use Active Chat Completion Preset</option>');
    for (const item of presets) {
        presetSelect.append(`<option value="${escapeHtml(item.value)}">${escapeHtml(item.label)}</option>`);
    }
    presetSelect.val(profile?.llmPreset || '');
}

async function generateQuietPromptWithEvaluatorModel(ctx, profile, quietPrompt) {
    const connectionProfile = String(profile?.llmConnectionProfile || '').trim();
    const chatCompletionPreset = String(profile?.llmPreset || '').trim();

    if (!connectionProfile && !chatCompletionPreset) {
        return ctx.generateQuietPrompt(quietPrompt);
    }

    const payload = {
        quietPrompt,
        connectionProfile,
        chatCompletionPreset
    };

    return ctx.generateQuietPrompt(payload);
}


function normalizeObjectiveEvaluationIssueLabels(issues) {
    if (!Array.isArray(issues)) return [];
    return issues
        .map(issue => String(issue || '').trim().toLowerCase())
        .filter(Boolean)
        .map(type => ({ type, message: `Flagged by evaluator: ${type}` }));
}

function ensureBusyIndicator() {
    const overlayHost = getOverlayHost();
    if (!overlayHost) return;
    if (document.getElementById('aspect_destinia_busy_indicator')) return;
    overlayHost.insertAdjacentHTML('beforeend', `
        <div id="aspect_destinia_busy_indicator" class="aspect-destinia-busy-indicator" aria-hidden="true">
            <i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>
            <span>Processing…</span>
        </div>
    `);
}

function getOverlayHost() {
    return document.body || document.documentElement || null;
}

function setBusyIndicatorVisible(visible) {
    ensureBusyIndicator();
    const el = document.getElementById('aspect_destinia_busy_indicator');
    if (!el) return;

    if (visible) {
        busyIndicatorShownAt = Date.now();
        el.classList.add('open');
        el.setAttribute('aria-hidden', 'false');
        return;
    }

    el.classList.remove('open');
    el.setAttribute('aria-hidden', 'true');
}

async function withBusyIndicator(task) {
    uiBusyCounter += 1;
    setBusyIndicatorVisible(true);
    try {
        return await task();
    } finally {
        uiBusyCounter = Math.max(0, uiBusyCounter - 1);
        if (uiBusyCounter === 0) {
            const elapsed = Date.now() - busyIndicatorShownAt;
            const remaining = Math.max(0, 300 - elapsed);
            if (remaining > 0) {
                await new Promise(resolve => setTimeout(resolve, remaining));
            }
            setBusyIndicatorVisible(false);
        }
    }
}

function bindDebouncedButtonAction(selector, handler, options = {}) {
    const debounceMs = Number(options.debounceMs ?? 220);
    const showBusy = options.showBusy !== false;
    const element = $(selector);
    if (!element.length) return;

    let debounceTimer = null;
    let running = false;

    element.on('click', function (event) {
        event.preventDefault();
        if (running) return;

        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }

        const button = this;
        debounceTimer = setTimeout(async () => {
            debounceTimer = null;
            running = true;
            const $button = $(button);
            $button.prop('disabled', true).addClass('aspect-destinia-busy-button');

            try {
                const run = () => Promise.resolve(handler.call(button));
                if (showBusy) {
                    await withBusyIndicator(run);
                } else {
                    await run();
                }
            } finally {
                running = false;
                $button.prop('disabled', false).removeClass('aspect-destinia-busy-button');
            }
        }, debounceMs);
    });
}

function replaceMacros(template, data) {
    return String(template || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
        return data[key] ?? '';
    });
}

function buildTemplateData(profile) {
    const timeline = getActiveTimeline(profile) || {};
    const current = getCurrentBeat(profile) || {};
    const next = getNextBeat(profile) || {};

    return {
        story_title: timeline.storyTitle || '',
        story_style: timeline.systemStyle || '',
        progression_notes: timeline.progressionNotes || '',
        total_beats: String(timeline.plotPoints?.length || 0),
        current_index: String((profile.state.currentIndex || 0) + 1),
        current_title: current.title || '',
        current_summary: current.summary || '',
        current_steering: current.steeringPrompt || '',
        current_pace: current.pace || 'medium',
        current_objectives: formatObjectives(current.objectives),
        current_hints: formatList(current.completionHints),
        current_objectives_inline: Array.isArray(current.objectives) ? current.objectives.map(o => normalizeObjectiveItem(o).text).join('; ') : '',
        current_objective_completion_inline: Array.isArray(current.objectives)
            ? current.objectives.map(o => `${normalizeObjectiveItem(o).text}: ${normalizeObjectiveItem(o).completed ? 'true' : 'false'}`).join('; ')
            : '',
        objective_completion_guidance: profile.prompts?.objectiveCompletionGuidance || '',
        transition_requirements: current.transitionGuidance || 'No transition guidance provided.',
        current_hints_inline: Array.isArray(current.completionHints) ? current.completionHints.join('; ') : '',
        next_title: next.title || 'None',
        next_summary: next.summary || 'No next plot point.',
        strictness: Number(profile.strictness || 0).toFixed(2),
        pacing_bias: Number(profile.pacingBias || 0).toFixed(2)
    };
}

function buildInjection(profile) {
    if (!profile?.enabled) return '';

    const data = buildTemplateData(profile);
    const prompts = profile.prompts || {};
    const chunks = [];

    chunks.push(replaceMacros(prompts.injectionIntro, data));
    chunks.push(replaceMacros(prompts.guidancePrinciples, data));
    chunks.push(replaceMacros(prompts.currentBeatTemplate, data));
    chunks.push(replaceMacros(prompts.transitionTemplate, data));

    if (profile.advancementMode === 'objectives') {
        chunks.push(replaceMacros(prompts.objectiveModeTemplate, data));
    } else {
        chunks.push(replaceMacros(prompts.hintModeTemplate, data));
    }

    if (profile.foreshadowNextBeat && getNextBeat(profile)) {
        chunks.push(replaceMacros(prompts.nextBeatTemplate, data));
    }

    chunks.push(replaceMacros(prompts.pacingInstruction, data));

    if (profile.respectUserIntent && profile.state.lastIntentDecision === 'advance') {
        chunks.push(prompts.advanceInstruction || '');
    } else {
        chunks.push(prompts.lingerInstruction || '');
    }

    if (profile.state.lastIntentReason) {
        chunks.push(`Most recent intent reasoning: ${profile.state.lastIntentReason}`);
    }

    if (profile.autoResolveDeviation) {
        if (profile.timelineDeviationAllowed) {
            chunks.push('Timeline Deviation Handling: ALLOWED. If the user meaningfully deviates from the planned timeline, adapt the timeline structure in a realistic way. Update plot point order/details and objective wording so the revised timeline reflects what happened naturally in-scene. Keep changes coherent, causal, and narratively rational.');
        } else {
            chunks.push('Timeline Deviation Handling: NOT ALLOWED. If deviation pressure appears, naturally re-align the scene to the active timeline plot point without abrupt railroading. Preserve immersion while steering events and character choices back toward current objectives and transition guidance.');
        }
    }

    return chunks.filter(Boolean).join('\n\n');
}

function updateExtensionPrompt() {
    try {
        const ctx = getCtx();
        const profile = getActiveProfile();

        if (!profile?.enabled) {
            if (typeof ctx.setExtensionPrompt === 'function') {
                ctx.setExtensionPrompt(EXTENSION_PROMPT_KEY, '');
            }
            return;
        }

        const injection = buildInjection(profile);

        if (typeof ctx.setExtensionPrompt !== 'function') {
            console.warn(`[${MODULE_NAME}] setExtensionPrompt is not available in this build.`);
            return;
        }

        const promptTypes = ctx.extensionPromptTypes || SillyTavern.extensionPromptTypes || {};
        const promptRoles = ctx.extensionPromptRoles || SillyTavern.extensionPromptRoles || {};
        const inPromptType = promptTypes.IN_PROMPT ?? 0;
        const systemRole = promptRoles.SYSTEM ?? 0;

        /*
         Use a stable, low-conflict insertion strategy.
         The exact numeric position can be adjusted later if needed,
         but this should work as a normal extension prompt.
         */
        ctx.setExtensionPrompt(
            EXTENSION_PROMPT_KEY,
            injection,
            inPromptType,
            0,
            false,
            systemRole
        );
    } catch (err) {
        console.error(`[${MODULE_NAME}] Failed to update extension prompt`, err);
    }
}

function chatHash(limit = 8) {
    const ctx = getCtx();
    const text = (ctx.chat || [])
        .slice(-limit)
        .map(m => `${m.is_user ? 'U' : 'A'}|${m.name || ''}|${m.send_date || ''}|${m.mes || ''}`)
        .join('\n');

    let h = 0;
    for (let i = 0; i < text.length; i++) {
        h = Math.imul(31, h) + text.charCodeAt(i) | 0;
    }
    return String(h);
}

function stringifyRecentChat(limit = 8) {
    const ctx = getCtx();
    return (ctx.chat || [])
        .slice(-limit)
        .map((m, idx) => `${idx + 1}. ${m.is_user ? 'User' : (m.name || 'Assistant')}: ${String(m.mes || '').trim()}`)
        .join('\n');
}

function stringifyRecentUserChat(limit = 8) {
    const ctx = getCtx();
    return (ctx.chat || [])
        .filter(m => m?.is_user)
        .slice(-limit)
        .map((m, idx) => `${idx + 1}. User: ${String(m.mes || '').trim()}`)
        .join('\n');
}

async function evaluateIntentIfNeeded(trigger = 'unknown') {
    return evaluateIntentIfNeededWithOptions(trigger, {});
}

async function evaluateIntentIfNeededWithOptions(trigger = 'unknown', options = {}) {
    const { force = false, notify = false } = options;
    const ctx = getCtx();
    const profile = getActiveProfile();
    if (!profile?.enabled) {
        if (notify) toastr.warning(`${MODULE_NAME}: no enabled active profile for this chat.`);
        return;
    }
    if (!force && !profile.autoAdvance && !profile.respectUserIntent) {
        if (notify) toastr.warning(`${MODULE_NAME}: enable auto-advance or respect intent to run intent checks.`);
        return;
    }

    const currentBeat = getCurrentBeat(profile);
    if (!currentBeat) {
        if (notify) toastr.warning(`${MODULE_NAME}: no current plot point is available.`);
        return;
    }

    const hash = chatHash(profile.intentWindow || 8);
    if (!force && hash === profile.state.lastEvalHash) return;

    profile.state.lastEvalHash = hash;

    const data = buildTemplateData(profile);
    data.recent_chat = stringifyRecentChat(profile.intentWindow || 8);
    data.recent_user_chat = stringifyRecentUserChat(profile.intentWindow || 8);

    const prompt = replaceMacros(profile.prompts.evaluatorPrompt || '', data);

    try {
        const parsed = await evaluateIntentModelOrFallback(ctx, prompt, profile, data.recent_chat);

        if (!parsed) {
            profile.state.lastIntentDecision = 'stay';
            profile.state.lastIntentConfidence = 0;
            profile.state.lastIntentReason = 'Evaluation returned non-JSON; defaulted to stay.';
            persistProfile(profile);
            updateExtensionPrompt();
            refreshUI();
            return;
        }

        const decision = parsed.decision === 'advance' ? 'advance' : 'stay';
        const confidence = clamp01(Number(parsed.confidence) || 0);
        const beatComplete = parseBooleanLike(parsed.beat_complete, false);
        const userWantsToLinger = parseBooleanLike(parsed.user_wants_to_linger, false);
        let objectiveCompletion = null;
        if (Array.isArray(parsed.objective_completion)) {
            objectiveCompletion = parsed.objective_completion.map(item => parseBooleanLike(item, false));
        } else if (parsed.objective_completion && typeof parsed.objective_completion === 'object') {
            objectiveCompletion = Object.values(parsed.objective_completion).map(item => parseBooleanLike(item, false));
        }

        let finalDecision = decision;
        if (userWantsToLinger) finalDecision = 'stay';
        if (!beatComplete && finalDecision === 'advance' && profile.advancementMode === 'objectives') {
            finalDecision = 'stay';
        }

        profile.state.lastIntentDecision = finalDecision;
        profile.state.lastIntentConfidence = confidence;
        profile.state.lastIntentReason = String(parsed.reason || 'No reason provided.');

        if (objectiveCompletion && profile.advancementMode === 'objectives') {
            const mutableCurrentBeat = getCurrentBeat(profile);
            if (Array.isArray(mutableCurrentBeat?.objectives)) {
                mutableCurrentBeat.objectives = mutableCurrentBeat.objectives.map((item, idx) => {
                    const normalized = normalizeObjectiveItem(item);
                    if (objectiveCompletion[idx]) {
                        normalized.completed = true;
                    }
                    return normalized;
                });
                profile.timelineText = JSON.stringify(profile.timeline, null, 2);
            }
        }

        profile.state.lastDiagnostic = {
            updatedAt: Date.now(),
            trigger,
            recentChat: data.recent_chat,
            evaluatorDecision: decision,
            finalDecision,
            confidence,
            beatComplete,
            userWantsToLinger,
            advancementMode: profile.advancementMode,
            currentBeatTitle: currentBeat?.title || '',
            currentBeatSummary: currentBeat?.summary || '',
            currentBeatObjectives: Array.isArray(currentBeat?.objectives) ? currentBeat.objectives : [],
            currentBeatHints: Array.isArray(currentBeat?.completionHints) ? currentBeat.completionHints : [],
            nextBeatTitle: getNextBeat(profile)?.title || 'None',
            nextBeatSummary: getNextBeat(profile)?.summary || 'No next plot point.'
        };

        const updatedBeat = getCurrentBeat(profile);
        const updatedObjectives = Array.isArray(updatedBeat?.objectives)
            ? updatedBeat.objectives.map(normalizeObjectiveItem)
            : [];
        const objectiveCompletionRatio = updatedObjectives.length
            ? updatedObjectives.filter(objective => objective.completed).length / updatedObjectives.length
            : 0;
        const objectiveReadyToAdvance =
            profile.advancementMode === 'objectives' &&
            updatedObjectives.length > 0 &&
            objectiveCompletionRatio >= getObjectiveCompletionThreshold(profile);

        const canAdvance =
            profile.autoAdvance &&
            !userWantsToLinger &&
            !!getNextBeat(profile) &&
            (
                (finalDecision === 'advance' && confidence >= Number(profile.transitionThreshold || 0.72)) ||
                objectiveReadyToAdvance
            );

        if (canAdvance) {
            profile.state.currentIndex += 1;
            profile.state.lastTransitionAt = Date.now();
            const newBeat = getCurrentBeat(profile);
            profile.state.lastIntentReason = `Advanced after ${trigger}: ${profile.state.lastIntentReason}`;
            toastr.info(`${MODULE_NAME}: moved to "${newBeat?.title || 'next plot point'}".`);
        }

        persistProfile(profile);
        updateExtensionPrompt();
        refreshUI();
        if (notify) toastr.success(`${MODULE_NAME}: intent check complete (${finalDecision}, ${confidence.toFixed(2)}).`);
    } catch (err) {
        console.warn(`[${MODULE_NAME}] Intent evaluation failed`, err);
        profile.state.lastIntentDecision = 'stay';
        profile.state.lastIntentReason = `Evaluation failed: ${err.message}`;
        persistProfile(profile);
        updateExtensionPrompt();
        refreshUI();
        if (notify) toastr.error(`${MODULE_NAME}: intent check failed (${err.message}).`);
    }
}

function findLatestAssistantMessageElement() {
    const ctx = getCtx();
    const chat = Array.isArray(ctx.chat) ? ctx.chat : [];
    let assistantIndex = -1;
    for (let i = chat.length - 1; i >= 0; i--) {
        if (!chat[i]?.is_user) {
            assistantIndex = i;
            break;
        }
    }

    if (assistantIndex !== -1) {
        const byAttr = document.querySelector(`#chat .mes[mesid="${assistantIndex}"]`)
            || document.querySelector(`#chat .mes[data-mesid="${assistantIndex}"]`);
        if (byAttr) return byAttr;
    }

    const all = Array.from(document.querySelectorAll('#chat .mes'));
    for (let i = all.length - 1; i >= 0; i--) {
        const el = all[i];
        const isUser =
            el.classList.contains('user_mes')
            || el.classList.contains('is_user')
            || el.getAttribute('is_user') === 'true'
            || el.dataset.isUser === 'true';
        if (!isUser) return el;
    }

    return null;
}

function buildDiagnosticBoxHtml(profile) {
    const current = getCurrentBeat(profile);
    const next = getNextBeat(profile);
    const diag = profile?.state?.lastDiagnostic || {};
    const infoUsed = [];
    if (Array.isArray(diag.currentBeatObjectives) && diag.currentBeatObjectives.length) {
        const objectivesHtml = diag.currentBeatObjectives
            .map(item => {
                const objective = normalizeObjectiveItem(item);
                const icon = objective.completed ? '☑' : '☐';
                return `<div class="aspect-destinia-diagnostic-objective-item"><span class="aspect-destinia-diagnostic-objective-icon" aria-hidden="true">${icon}</span> <span>${escapeHtml(objective.text || 'Untitled objective')}</span></div>`;
            })
            .join('');
        infoUsed.push(`<div><b class="aspect-destinia-diagnostic-sand">Objectives:</b></div><div class="aspect-destinia-diagnostic-objectives">${objectivesHtml}</div>`);
    }
    if (Array.isArray(diag.currentBeatHints) && diag.currentBeatHints.length) {
        infoUsed.push(`<div><b class="aspect-destinia-diagnostic-sand">Completion hints:</b> ${escapeHtml(diag.currentBeatHints.join(' | '))}</div>`);
    }

    return `
        <div class="aspect-destinia-diagnostic-container" data-collapsed="true">
            <div class="aspect-destinia-diagnostic-header">
                <button class="aspect-destinia-diagnostic-toggle" title="Toggle diagnostic visibility"><i class="fa-solid fa-hourglass-half"></i></button>
                <div class="aspect-destinia-diagnostic-timeline-label">Timeline (Diagnostics)</div>
            </div>
            <div class="aspect-destinia-diagnostic-box">
            <div class="aspect-destinia-diagnostic-content">
                <div><b class="aspect-destinia-diagnostic-sand">Current story plot point:</b> ${escapeHtml(current?.title || 'None')}</div>
                <div><b class="aspect-destinia-diagnostic-sand">Next story plot point:</b> ${escapeHtml(next?.title || 'None')}</div>
                <div><b class="aspect-destinia-diagnostic-sand">Intent decision:</b> ${escapeHtml(profile?.state?.lastIntentDecision || 'stay')} (${Number(profile?.state?.lastIntentConfidence || 0).toFixed(2)})</div>
                <div><b class="aspect-destinia-diagnostic-sand">Reason:</b> ${escapeHtml(profile?.state?.lastIntentReason || 'No evaluation yet.')}</div>
                <details>
                    <summary><b>Information used for this response</b></summary>
                    <div class="aspect-destinia-diagnostic-body">${infoUsed.join('') || 'No diagnostics captured yet.'}</div>
                </details>
            </div>
            </div>
        </div>
    `;
}

function renderDiagnosticForLatestAssistantMessage() {
    const profile = getActiveProfile();
    if (!profile?.enabled) return;
    const el = findLatestAssistantMessageElement();
    if (!el) return;

    el.querySelectorAll('.aspect-destinia-diagnostic-container').forEach(x => x.remove());

    const messageBody =
        el.querySelector('.mes_text')
        || el.querySelector('.message_text')
        || el.querySelector('.mes_block')
        || el;

    messageBody.insertAdjacentHTML('beforeend', buildDiagnosticBoxHtml(profile));

    const inserted = messageBody.querySelector('.aspect-destinia-diagnostic-container:last-of-type');
    const toggle = inserted?.querySelector('.aspect-destinia-diagnostic-toggle');
    toggle?.addEventListener('click', () => {
        const collapsed = inserted.getAttribute('data-collapsed') === 'true';
        inserted.setAttribute('data-collapsed', collapsed ? 'false' : 'true');
    });
}

function parseJsonObject(text) {
    if (!text) return null;
    const raw = String(text).trim();
    try {
        return JSON.parse(raw);
    } catch {
        const match = raw.match(/\{[\s\S]*\}/);
        if (!match) return null;
        try {
            return JSON.parse(match[0]);
        } catch {
            return null;
        }
    }
}

function parseBooleanLike(value, fallback = false) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['true', 'yes', 'y', '1'].includes(normalized)) return true;
        if (['false', 'no', 'n', '0'].includes(normalized)) return false;
    }
    return fallback;
}

async function evaluateIntentModelOrFallback(ctx, prompt, profile, recentChatText) {
    if (remoteIntentEvalDisabled) {
        return evaluateIntentLocally(profile, recentChatText);
    }

    try {
        const result = await generateQuietPromptWithEvaluatorModel(ctx, profile, prompt);
        const parsed = parseJsonObject(result);
        if (!parsed) {
            return null;
        }
        return parsed;
    } catch (err) {
        const message = String(err?.message || err || '');
        const degradedFunctionError =
            message.includes('DEGRADED function cannot be invoked') ||
            (message.includes('Function id') && message.includes('Bad Request')) ||
            message.includes('System message must be at the beginning');

        if (degradedFunctionError) {
            remoteIntentEvalDisabled = true;
            toastr.warning(`${MODULE_NAME}: intent evaluator switched to local fallback due to backend function-tool availability.`);
            return evaluateIntentLocally(profile, recentChatText);
        }

        throw err;
    }
}

function evaluateIntentLocally(profile, recentChatText) {
    const text = String(recentChatText || '');
    const roleTaggedLines = text
        .split('\n')
        .map(line => line.trim())
        .filter(line => /^\d+\.\s*(user|assistant)\s*:/i.test(line));

    const userLines = roleTaggedLines
        .filter(line => /^\d+\.\s*user\s*:/i.test(line))
        .slice(-3)
        .map(line => line.replace(/^\d+\.\s*user\s*:/i, '').trim())
        .join(' ');

    const assistantLines = roleTaggedLines
        .filter(line => /^\d+\.\s*assistant\s*:/i.test(line))
        .slice(-3)
        .map(line => line.replace(/^\d+\.\s*assistant\s*:/i, '').trim())
        .join(' ');

    const userLinesLower = userLines.toLowerCase();
    const assistantLinesLower = assistantLines.toLowerCase();
    const interactionLower = `${userLinesLower} ${assistantLinesLower}`.trim();

    const strongAdvanceSignals = [
        'move on', 'head to', 'after this', 'done here', 'finished here',
        'leave now', 'let\'s go', 'lets go', 'proceed', 'advance'
    ];
    const weakAdvanceSignals = ['next', 'continue'];
    const explicitLingerSignals = [
        'wait', 'hold on', 'stay', 'linger', 'not yet', 'before we go',
        'do not move on', "don't move on", 'keep exploring', 'one more thing', 'give me a minute'
    ];
    const deepenTaskSignals = [
        'investigate', 'look around', 'search', 'inspect', 'question them', 'interrogate',
        'reflect', 'train', 'plan this out', 'discuss this first'
    ];

    const countSignalHits = (signals = []) => signals.filter((signal) => {
        const escaped = signal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = signal.includes(' ')
            ? new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i')
            : new RegExp(`\\b${escaped}\\b`, 'i');
        return pattern.test(userLinesLower);
    }).length;

    const strongAdvanceHits = countSignalHits(strongAdvanceSignals);
    const weakAdvanceHits = countSignalHits(weakAdvanceSignals);
    const explicitLingerHits = countSignalHits(explicitLingerSignals);
    const deepenTaskHits = countSignalHits(deepenTaskSignals);
    const importantConversationSignal = /\b(confess|confession|reveal|truth|motive|motivation|betray|betrayal|deal|agreement|negotiate|negotiation|interrogate|strategy|plan|critical|urgent|high stakes|life or death|consequence|secret|apologize|forgive)\b/i.test(interactionLower);
    const conversationHoldSignal = /\b(talk|discuss|ask|question|explain|hear me out|we need to talk)\b/i.test(userLinesLower);
    const lingerHits = explicitLingerHits + deepenTaskHits + (importantConversationSignal && conversationHoldSignal ? 1 : 0);

    let decision = 'stay';
    let confidence = 0.55;
    let reason = 'Evaluator found no strong progression signal.';

    if (strongAdvanceHits > 0 && lingerHits === 0) {
        decision = 'advance';
        confidence = Math.min(0.9, 0.7 + (strongAdvanceHits * 0.07));
        reason = 'Evaluator detected forward-progress wording from the user.';
    } else if (weakAdvanceHits >= 2 && lingerHits === 0) {
        decision = 'advance';
        confidence = 0.64;
        reason = 'Evaluator detected repeated weak progression wording from the user.';
    } else if (lingerHits > 0) {
        decision = 'stay';
        confidence = Math.min(0.9, 0.65 + (lingerHits * 0.07));
        reason = 'Evaluator detected linger/deepen wording from the user.';
    }

    const currentBeat = getCurrentBeat(profile);
    const hints = Array.isArray(currentBeat?.completionHints) ? currentBeat.completionHints : [];
    const objectives = Array.isArray(currentBeat?.objectives) ? currentBeat.objectives.map(normalizeObjectiveItem) : [];
    const completionVerbSignals = [
        'done', 'completed', 'finished', 'resolved', 'handled', 'achieved', 'accomplished', 'wrapped up', 'took care of'
    ];
    const objectiveActionSignals = [
        'introduced', 'explained', 'revealed', 'established', 'discussed', 'learned', 'discovered',
        'confirmed', 'decided', 'resolved', 'confronted', 'admitted', 'bonded', 'opened up'
    ];
    const userWordSet = new Set((userLinesLower.match(/[a-z0-9']+/g) || []).filter(Boolean));

    const hasObjectiveCompletionSignal = (objectiveText) => {
        const objectiveWords = String(objectiveText || '')
            .toLowerCase()
            .replace(/[^a-z0-9'\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 2 && !['the', 'and', 'with', 'from', 'that', 'this', 'into', 'about'].includes(word));

        if (!objectiveWords.length) return false;

        const userWords = Array.from(userWordSet);
        const stems = objectiveWords.map(word => word.replace(/(ing|ed|es|s)$/i, ''));
        const matchedWords = objectiveWords.filter(word => userWordSet.has(word));
        const matchedStems = stems.filter(stem => stem && userWords.some(word => word.startsWith(stem) || stem.startsWith(word)));
        const overlapRatio = matchedWords.length / objectiveWords.length;
        const stemOverlapRatio = matchedStems.length / objectiveWords.length;
        const hasCompletionVerb = completionVerbSignals.some(signal => userLinesLower.includes(signal));
        const hasObjectiveActionSignal = objectiveActionSignals.some(signal => userLinesLower.includes(signal));

        if ((overlapRatio >= 0.55 || stemOverlapRatio >= 0.6) && matchedWords.length >= 2) {
            return true;
        }

        if (hasCompletionVerb && (matchedWords.length >= 2 || matchedStems.length >= 3)) {
            return true;
        }

        return hasObjectiveActionSignal && (matchedWords.length >= 2 || matchedStems.length >= 3);
    };

    const objectiveCompletion = objectives.map(objective => {
        if (objective.completed) return true;
        if (hasObjectiveCompletionSignal(objective.text)) return true;
        return false;
    });
    const completionRatio = objectiveCompletion.length > 0
        ? objectiveCompletion.filter(Boolean).length / objectiveCompletion.length
        : 0;
    const beatCompleteFromObjectives = objectiveCompletion.length > 0
        ? completionRatio >= getObjectiveCompletionThreshold(profile)
        : false;
    const beatComplete = hints.length > 0
        ? hints.some(h => userLinesLower.includes(String(h).toLowerCase().slice(0, 24))) || beatCompleteFromObjectives
        : beatCompleteFromObjectives;

    return {
        decision,
        confidence,
        reason,
        beat_complete: beatComplete,
        user_wants_to_linger: explicitLingerHits > 0 || deepenTaskHits > 0 || (importantConversationSignal && conversationHoldSignal),
        objective_completion: objectiveCompletion
    };
}

function clamp01(n) {
    if (Number.isNaN(n)) return 0;
    return Math.max(0, Math.min(1, n));
}

function persistProfile(profile) {
    const profiles = getProfiles();
    const idx = profiles.findIndex(p => p.id === profile.id);
    if (idx !== -1) {
        profiles[idx] = profile;
        saveSettings();
        updateExtensionPrompt();
    }
}

function createProfileAttachedToCurrentChat() {
    registerKnownChat();

    const chatKey = getChatKey();
    const chatLabel = getChatLabel();

    const profile = mergeDeep(structuredClone(DEFAULT_PROFILE), {
        id: makeId('entry'),
        entryName: chatLabel || 'Current Chat',
        attachedChatKey: chatKey,
        attachedChatLabel: chatLabel
    });

    getProfiles().push(profile);
    setSelectedProfileId(profile.id);

    const metadata = getMetadataBucket();
    metadata.profileId = profile.id;
    saveSettings();
    saveChatMetadata();

    updateExtensionPrompt();
    toastr.success(`${MODULE_NAME}: created profile and attached it to the current chat.`);
    refreshUI();
}

function deleteSelectedProfile() {
    const profile = getDisplayedProfile();
    if (!profile) return;

    const settings = ensureSettings();
    settings.profiles = settings.profiles.filter(p => p.id !== profile.id);

    if (getMetadataBucket().profileId === profile.id) {
        delete getMetadataBucket().profileId;
        saveChatMetadata();
    }

    if (settings.ui.selectedProfileId === profile.id) {
        settings.ui.selectedProfileId = settings.profiles[0]?.id || '';
    }

    saveSettings();
    toastr.info(`${MODULE_NAME}: deleted profile "${getProfileDisplayName(profile)}".`);
    refreshUI();
}

function duplicateSelectedProfile() {
    const profile = getDisplayedProfile();
    if (!profile) return;

    const copy = structuredClone(profile);
    copy.id = makeId('entry');
    copy.entryName = `${getProfileDisplayName(profile)} (Copy)`;

    getProfiles().push(copy);
    setSelectedProfileId(copy.id);
    saveSettings();
    toastr.success(`${MODULE_NAME}: duplicated profile.`);
    refreshUI();
}

function attachSelectedProfileToCurrentChat() {
    const profile = getDisplayedProfile();
    if (!profile) return;

    registerKnownChat();

    profile.attachedChatKey = getChatKey();
    profile.attachedChatLabel = getChatLabel();
    persistProfile(profile);

    const metadata = getMetadataBucket();
    metadata.profileId = profile.id;
    saveChatMetadata();

    updateExtensionPrompt();
    toastr.success(`${MODULE_NAME}: attached selected profile to the current chat.`);
    refreshUI();
}

function getDisplayedProfile() {
    const selectedId = $('#aspect_destinia_profile_select').val() || getLinkedProfileIdForCurrentChat() || getSelectedProfileId();
    if (!selectedId) return null;
    return getProfileById(selectedId);
}

function renameDisplayedProfile() {
    const profile = getDisplayedProfile();
    if (!profile) {
        toastr.warning(`${MODULE_NAME}: no selected profile to rename.`);
        return;
    }

    const nextName = window.prompt('Rename profile', getProfileDisplayName(profile));
    if (nextName === null) return;

    const trimmedName = String(nextName || '').trim();
    if (!trimmedName) {
        toastr.warning(`${MODULE_NAME}: profile name cannot be empty.`);
        return;
    }

    profile.entryName = trimmedName;
    persistProfile(profile);
    refreshUI();
    toastr.success(`${MODULE_NAME}: renamed profile.`);
}

function profileToForm(profile) {
    if (!profile) {
        clearForm();
        return;
    }

    $('#aspect_destinia_profile_select').val(profile.id);
    $('#aspect_destinia_enabled').prop('checked', !!profile.enabled);
    $('#aspect_destinia_mode').val(profile.advancementMode || 'objectives');
    $('#aspect_destinia_auto_advance').prop('checked', !!profile.autoAdvance);
    $('#aspect_destinia_foreshadow').prop('checked', !!profile.foreshadowNextBeat);
    $('#aspect_destinia_respect_intent').prop('checked', !!profile.respectUserIntent);
    $('#aspect_destinia_timeline_deviation_allowed').prop('checked', !!profile.timelineDeviationAllowed);
    $('#aspect_destinia_auto_resolve_deviation').prop('checked', !!profile.autoResolveDeviation);
    $('#aspect_destinia_strictness').val(profile.strictness ?? 0.55);
    $('#aspect_destinia_pacing').val(profile.pacingBias ?? 0.45);
    $('#aspect_destinia_threshold').val(profile.transitionThreshold ?? 0.72);
    $('#aspect_destinia_objective_threshold').val(getObjectiveCompletionThreshold(profile));
    $('#aspect_destinia_window').val(profile.intentWindow ?? 8);
    renderEvaluatorModelOptions(profile);
    $('#aspect_destinia_chat_select').val(profile.attachedChatKey || '');
    $('#aspect_destinia_timeline').val(profile.timelineText || JSON.stringify(DEFAULT_TIMELINE_TEMPLATE, null, 2));

    $('#aspect_destinia_prompt_intro').val(profile.prompts.injectionIntro || '');
    $('#aspect_destinia_prompt_principles').val(profile.prompts.guidancePrinciples || '');
    $('#aspect_destinia_prompt_current').val(profile.prompts.currentBeatTemplate || '');
    $('#aspect_destinia_prompt_objectives').val(profile.prompts.objectiveModeTemplate || '');
    $('#aspect_destinia_prompt_hints').val(profile.prompts.hintModeTemplate || '');
    $('#aspect_destinia_prompt_next').val(profile.prompts.nextBeatTemplate || '');
    $('#aspect_destinia_prompt_transition').val(profile.prompts.transitionTemplate || '');
    $('#aspect_destinia_prompt_linger').val(profile.prompts.lingerInstruction || '');
    $('#aspect_destinia_prompt_advance').val(profile.prompts.advanceInstruction || '');
    $('#aspect_destinia_prompt_pacing').val(profile.prompts.pacingInstruction || '');
    $('#aspect_destinia_prompt_objective_guidance').val(profile.prompts.objectiveCompletionGuidance || '');
    $('#aspect_destinia_prompt_evaluator').val(profile.prompts.evaluatorPrompt || '');

    renderStatus(profile);
    updateFieldValidationIndicators();
}

function clearForm() {
    $('#aspect_destinia_enabled').prop('checked', true);
    $('#aspect_destinia_mode').val('objectives');
    $('#aspect_destinia_auto_advance').prop('checked', true);
    $('#aspect_destinia_foreshadow').prop('checked', true);
    $('#aspect_destinia_respect_intent').prop('checked', true);
    $('#aspect_destinia_timeline_deviation_allowed').prop('checked', false);
    $('#aspect_destinia_auto_resolve_deviation').prop('checked', false);
    $('#aspect_destinia_strictness').val(0.55);
    $('#aspect_destinia_pacing').val(0.45);
    $('#aspect_destinia_threshold').val(0.72);
    $('#aspect_destinia_objective_threshold').val(0.8);
    $('#aspect_destinia_window').val(8);
    $('#aspect_destinia_eval_connection').val('');
    $('#aspect_destinia_eval_preset').val('');
    $('#aspect_destinia_chat_select').val('');
    $('#aspect_destinia_timeline').val(JSON.stringify(DEFAULT_TIMELINE_TEMPLATE, null, 2));
    $('#aspect_destinia_prompt_intro').val(DEFAULT_PROFILE.prompts.injectionIntro || '');
    $('#aspect_destinia_prompt_principles').val(DEFAULT_PROFILE.prompts.guidancePrinciples || '');
    $('#aspect_destinia_prompt_current').val(DEFAULT_PROFILE.prompts.currentBeatTemplate || '');
    $('#aspect_destinia_prompt_objectives').val(DEFAULT_PROFILE.prompts.objectiveModeTemplate || '');
    $('#aspect_destinia_prompt_hints').val(DEFAULT_PROFILE.prompts.hintModeTemplate || '');
    $('#aspect_destinia_prompt_next').val(DEFAULT_PROFILE.prompts.nextBeatTemplate || '');
    $('#aspect_destinia_prompt_transition').val(DEFAULT_PROFILE.prompts.transitionTemplate || '');
    $('#aspect_destinia_prompt_linger').val(DEFAULT_PROFILE.prompts.lingerInstruction || '');
    $('#aspect_destinia_prompt_advance').val(DEFAULT_PROFILE.prompts.advanceInstruction || '');
    $('#aspect_destinia_prompt_pacing').val(DEFAULT_PROFILE.prompts.pacingInstruction || '');
    $('#aspect_destinia_prompt_objective_guidance').val(DEFAULT_PROFILE.prompts.objectiveCompletionGuidance || '');
    $('#aspect_destinia_prompt_evaluator').val(DEFAULT_PROFILE.prompts.evaluatorPrompt || '');
    updateFieldValidationIndicators();
}

function formToProfile(profile) {
    const parsedTimeline = safeParseTimeline($('#aspect_destinia_timeline').val());
    if (!parsedTimeline) {
        throw new Error('Timeline JSON must be valid and include plotPoints[].');
    }

    profile.enabled = $('#aspect_destinia_enabled').is(':checked');
    profile.advancementMode = $('#aspect_destinia_mode').val();
    profile.autoAdvance = $('#aspect_destinia_auto_advance').is(':checked');
    profile.foreshadowNextBeat = $('#aspect_destinia_foreshadow').is(':checked');
    profile.respectUserIntent = $('#aspect_destinia_respect_intent').is(':checked');
    profile.timelineDeviationAllowed = $('#aspect_destinia_timeline_deviation_allowed').is(':checked');
    profile.autoResolveDeviation = $('#aspect_destinia_auto_resolve_deviation').is(':checked');
    profile.strictness = Number($('#aspect_destinia_strictness').val() || 0.55);
    profile.pacingBias = Number($('#aspect_destinia_pacing').val() || 0.45);
    profile.transitionThreshold = Number($('#aspect_destinia_threshold').val() || 0.72);
    profile.objectiveAutoAdvanceThreshold = clamp01(Number($('#aspect_destinia_objective_threshold').val() || 0.8));
    profile.intentWindow = Number($('#aspect_destinia_window').val() || 8);
    profile.llmConnectionProfile = $('#aspect_destinia_eval_connection').val() || '';
    profile.llmPreset = $('#aspect_destinia_eval_preset').val() || '';

    const selectedChatKey = $('#aspect_destinia_chat_select').val() || '';
    const knownChat = ensureSettings().knownChats.find(x => x.key === selectedChatKey);
    profile.attachedChatKey = selectedChatKey;
    profile.attachedChatLabel = knownChat?.label || profile.attachedChatLabel || '';

    profile.timelineText = $('#aspect_destinia_timeline').val();
    profile.timeline = parsedTimeline;

    profile.prompts.injectionIntro = $('#aspect_destinia_prompt_intro').val();
    profile.prompts.guidancePrinciples = $('#aspect_destinia_prompt_principles').val();
    profile.prompts.currentBeatTemplate = $('#aspect_destinia_prompt_current').val();
    profile.prompts.objectiveModeTemplate = $('#aspect_destinia_prompt_objectives').val();
    profile.prompts.hintModeTemplate = $('#aspect_destinia_prompt_hints').val();
    profile.prompts.nextBeatTemplate = $('#aspect_destinia_prompt_next').val();
    profile.prompts.transitionTemplate = $('#aspect_destinia_prompt_transition').val();
    profile.prompts.lingerInstruction = $('#aspect_destinia_prompt_linger').val();
    profile.prompts.advanceInstruction = $('#aspect_destinia_prompt_advance').val();
    profile.prompts.pacingInstruction = $('#aspect_destinia_prompt_pacing').val();
    profile.prompts.objectiveCompletionGuidance = $('#aspect_destinia_prompt_objective_guidance').val();
    profile.prompts.evaluatorPrompt = $('#aspect_destinia_prompt_evaluator').val();

    const totalBeats = profile.timeline.plotPoints.length;
    if (profile.state.currentIndex >= totalBeats) {
        profile.state.currentIndex = Math.max(0, totalBeats - 1);
    }
}


function buildExportFilename(label, extension = 'json') {
    const sanitizedLabel = String(label || 'export')
        .trim()
        .replace(/[^a-z0-9_-]+/gi, '_')
        .replace(/^_+|_+$/g, '')
        .toLowerCase() || 'export';
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `${sanitizedLabel}_${stamp}.${extension}`;
}

function downloadJsonToFile(payload, filenameLabel) {
    const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
    const blob = new Blob([serialized], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = buildExportFilename(filenameLabel, 'json');
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
}

function exportDisplayedProfileToFile() {
    const profile = getDisplayedProfile();
    if (!profile) {
        toastr.warning(`${MODULE_NAME}: no selected profile to export.`);
        return;
    }

    downloadJsonToFile(profile, `${getProfileDisplayName(profile) || 'destinia_profile'}_profile`);
}

function exportTimelineToFile() {
    const timelineText = String($('#aspect_destinia_timeline').val() || '').trim();
    if (!timelineText) {
        toastr.warning(`${MODULE_NAME}: timeline JSON is empty.`);
        return;
    }

    const parsed = safeParseTimeline(timelineText);
    if (!parsed) {
        toastr.error(`${MODULE_NAME}: cannot export invalid timeline JSON.`);
        return;
    }

    downloadJsonToFile(parsed, 'timeline_json');
}

function importTimelineFromFile(event) {
    const file = event?.target?.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
        try {
            const text = String(reader.result || '').trim();
            const parsed = safeParseTimeline(text);
            if (!parsed) {
                throw new Error('timeline JSON must include plotPoints[].');
            }

            $('#aspect_destinia_timeline').val(JSON.stringify(parsed, null, 2));
            updateFieldValidationIndicators();
            toastr.success(`${MODULE_NAME}: imported timeline JSON from file.`);
        } catch (err) {
            toastr.error(`${MODULE_NAME}: failed to import timeline (${err.message}).`);
        } finally {
            $('#aspect_destinia_timeline_import_file').val('');
        }
    };
    reader.readAsText(file);
}

function importProfileFromFile(event) {
    const file = event?.target?.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
        try {
            const parsed = JSON.parse(String(reader.result || '{}'));
            const imported = mergeDeep(structuredClone(DEFAULT_PROFILE), parsed || {});
            imported.id = makeId('destinia');
            imported.entryName = `${getProfileDisplayName(imported) || 'Imported Profile'} (Imported)`;
            imported.timeline = normalizeTimeline(imported.timeline || safeParseTimeline(imported.timelineText) || structuredClone(DEFAULT_TIMELINE_TEMPLATE));
            imported.timelineText = JSON.stringify(imported.timeline, null, 2);
            getProfiles().push(imported);
            persistProfile(imported);
            setSelectedProfileId(imported.id);
            refreshUI();
            toastr.success(`${MODULE_NAME}: imported profile from file.`);
        } catch (err) {
            toastr.error(`${MODULE_NAME}: failed to import profile (${err.message}).`);
        } finally {
            $('#aspect_destinia_import_file').val('');
        }
    };
    reader.readAsText(file);
}

const FIELD_DEFAULTS = {
    aspect_destinia_window: () => DEFAULT_PROFILE.intentWindow,
    aspect_destinia_strictness: () => DEFAULT_PROFILE.strictness,
    aspect_destinia_pacing: () => DEFAULT_PROFILE.pacingBias,
    aspect_destinia_threshold: () => DEFAULT_PROFILE.transitionThreshold,
    aspect_destinia_objective_threshold: () => DEFAULT_PROFILE.objectiveAutoAdvanceThreshold,
    aspect_destinia_timeline: () => JSON.stringify(DEFAULT_TIMELINE_TEMPLATE, null, 2),
    aspect_destinia_prompt_intro: () => DEFAULT_PROFILE.prompts.injectionIntro,
    aspect_destinia_prompt_principles: () => DEFAULT_PROFILE.prompts.guidancePrinciples,
    aspect_destinia_prompt_current: () => DEFAULT_PROFILE.prompts.currentBeatTemplate,
    aspect_destinia_prompt_next: () => DEFAULT_PROFILE.prompts.nextBeatTemplate,
    aspect_destinia_prompt_transition: () => DEFAULT_PROFILE.prompts.transitionTemplate,
    aspect_destinia_prompt_objectives: () => DEFAULT_PROFILE.prompts.objectiveModeTemplate,
    aspect_destinia_prompt_hints: () => DEFAULT_PROFILE.prompts.hintModeTemplate,
    aspect_destinia_prompt_linger: () => DEFAULT_PROFILE.prompts.lingerInstruction,
    aspect_destinia_prompt_advance: () => DEFAULT_PROFILE.prompts.advanceInstruction,
    aspect_destinia_prompt_pacing: () => DEFAULT_PROFILE.prompts.pacingInstruction,
    aspect_destinia_prompt_objective_guidance: () => DEFAULT_PROFILE.prompts.objectiveCompletionGuidance,
    aspect_destinia_prompt_evaluator: () => DEFAULT_PROFILE.prompts.evaluatorPrompt,
};

function resetFieldToDefault(fieldId) {
    const factory = FIELD_DEFAULTS[fieldId];
    if (!factory) return;
    const el = document.getElementById(fieldId);
    if (!el) return;

    const value = factory();
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
        el.value = String(value ?? '');
    }

    if (fieldId === 'aspect_destinia_timeline') {
        const parsed = safeParseTimeline(String(value || ''));
        if (!parsed) {
            toastr.error(`${MODULE_NAME}: failed to reset timeline to defaults.`);
        }
    }

    updateSliderDisplays();
    updateFieldValidationIndicators();
    toastr.info(`${MODULE_NAME}: reset field to default.`);
}

function addFieldResetButtons() {
    for (const fieldId of Object.keys(FIELD_DEFAULTS)) {
        const fieldEl = document.getElementById(fieldId);
        if (!fieldEl) continue;
        if (document.querySelector(`.aspect-destinia-field-reset[data-for="${fieldId}"]`)) continue;

        const btn = document.createElement('button');
        btn.className = 'menu_button aspect-destinia-field-reset';
        btn.type = 'button';
        btn.dataset.for = fieldId;
        const isSlider = fieldEl.tagName === 'INPUT' && String(fieldEl.getAttribute('type') || '').toLowerCase() === 'range';
        btn.textContent = isSlider ? 'Reset Slider' : 'Reset';
        btn.addEventListener('click', () => resetFieldToDefault(fieldId));

        fieldEl.insertAdjacentElement('afterend', btn);
    }
}

async function clearCurrentChatMessages() {
    const ctx = getCtx();
    const count = Array.isArray(ctx.chat) ? ctx.chat.length : 0;
    if (!count) {
        toastr.info(`${MODULE_NAME}: current chat is already empty.`);
        return;
    }

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
        } else if (typeof ctx.saveChatDebounced === 'function') {
            ctx.saveChatDebounced();
        }

        toastr.success(`${MODULE_NAME}: deleted ${count} message(s) from the current chat.`);
        renderDiagnosticForLatestAssistantMessage();
    } catch (err) {
        toastr.error(`${MODULE_NAME}: failed to clear current chat (${err.message}).`);
    }
}

function saveDisplayedProfile() {
    const profile = getDisplayedProfile();
    if (!profile) {
        toastr.warning(`${MODULE_NAME}: create a profile first.`);
        return;
    }

    try {
        formToProfile(profile);
        persistProfile(profile);

        if (profile.attachedChatKey === getChatKey()) {
            getMetadataBucket().profileId = profile.id;
            saveChatMetadata();
        }

        updateExtensionPrompt();
        toastr.success(`${MODULE_NAME}: saved settings to "${getProfileDisplayName(profile)}".`);
        refreshUI();
    } catch (err) {
        toastr.error(`${MODULE_NAME}: ${err.message}`);
    }
}

function resetCurrentBeatToFirst() {
    const profile = getDisplayedProfile();
    if (!profile) return;
    profile.state.currentIndex = 0;
    profile.state.lastIntentDecision = 'stay';
    profile.state.lastIntentReason = 'Manually reset to the first plot point.';
    persistProfile(profile);
    updateExtensionPrompt();
    toastr.info(`${MODULE_NAME}: reset to the first plot point.`);
    refreshUI();
}

function stepBeat(delta) {
    const profile = getDisplayedProfile();
    if (!profile) return;

    const timeline = getActiveTimeline(profile);
    const max = Math.max(0, (timeline?.plotPoints?.length || 1) - 1);
    profile.state.currentIndex = Math.max(0, Math.min(max, (profile.state.currentIndex || 0) + delta));
    profile.state.lastIntentReason = `Manually adjusted current plot point to index ${profile.state.currentIndex + 1}.`;
    persistProfile(profile);
    updateExtensionPrompt();
    refreshUI();
}

function renderStatus(profile) {
    const current = getCurrentBeat(profile);
    const next = getNextBeat(profile);

    $('#aspect_destinia_status').html(`
        <div class="aspect-destinia-status-grid">
            <div class="aspect-destinia-stat">
                <div class="aspect-destinia-stat-label">Current Plot Point</div>
                <div class="aspect-destinia-stat-value">${escapeHtml(current?.title || 'None')}</div>
            </div>
            <div class="aspect-destinia-stat">
                <div class="aspect-destinia-stat-label">Next Plot Point</div>
                <div class="aspect-destinia-stat-value">${escapeHtml(next?.title || 'None')}</div>
            </div>
            <div class="aspect-destinia-stat">
                <div class="aspect-destinia-stat-label">Last Intent</div>
                <div class="aspect-destinia-stat-value">${escapeHtml(profile?.state?.lastIntentDecision || 'stay')}</div>
            </div>
            <div class="aspect-destinia-stat">
                <div class="aspect-destinia-stat-label">Last Confidence</div>
                <div class="aspect-destinia-stat-value">${Number(profile?.state?.lastIntentConfidence || 0).toFixed(2)}</div>
            </div>
        </div>
        <div class="aspect-destinia-status-reason">
            ${escapeHtml(profile?.state?.lastIntentReason || 'No evaluation yet.')}
        </div>
        <div class="aspect-destinia-objective-list">
            ${(Array.isArray(current?.objectives) && current.objectives.length)
                ? current.objectives.map((obj) => {
                    const normalized = normalizeObjectiveItem(obj);
                    return `<div class="aspect-destinia-objective-row"><span class="aspect-destinia-objective-icon" aria-hidden="true">${normalized.completed ? '☑' : '☐'}</span> <span>${escapeHtml(normalized.text)} <code>${normalized.completed ? 'true' : 'false'}</code></span></div>`;
                }).join('')
                : '<div class="aspect-destinia-empty">No objectives on this plot point.</div>'}
        </div>
    `);
}

function escapeHtml(text) {
    return String(text ?? '').replace(/[&<>"']/g, s => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[s]));
}

function renderProfileOptions() {
    const profiles = getProfiles();
    const select = $('#aspect_destinia_profile_select');
    const activeId = getLinkedProfileIdForCurrentChat() || getSelectedProfileId() || profiles[0]?.id || '';

    select.empty();
    select.append(`<option value="">-- Select Profile --</option>`);
    for (const profile of profiles) {
        select.append(`<option value="${escapeHtml(profile.id)}">${escapeHtml(getProfileDisplayName(profile))}</option>`);
    }
    select.val(activeId);
}

function renderKnownChatOptions() {
    registerKnownChat();

    const knownChats = ensureSettings().knownChats;
    const select = $('#aspect_destinia_chat_select');
    const currentProfile = getDisplayedProfile();

    select.empty();
    select.append(`<option value="">-- No Attached Chat --</option>`);
    for (const chat of knownChats) {
        select.append(`<option value="${escapeHtml(chat.key)}">${escapeHtml(chat.label)}</option>`);
    }

    if (currentProfile?.attachedChatKey) {
        select.val(currentProfile.attachedChatKey);
    } else {
        select.val(getChatKey());
    }
}

function refreshUI() {
    if (!document.getElementById(ROOT_ID)) return;

    renderProfileOptions();
    renderKnownChatOptions();

    const profile = getDisplayedProfile() || getActiveProfile();
    if (profile) {
        profileToForm(profile);
    } else {
        clearForm();
        $('#aspect_destinia_status').html('<div class="aspect-destinia-empty">No profile selected. Create one to bind story progression to this chat.</div>');
    }

    updateSliderDisplays();
    updateExtensionPrompt();
}

function updateSliderDisplays() {
    $('#aspect_destinia_strictness_value').text(Number($('#aspect_destinia_strictness').val() || 0).toFixed(2));
    $('#aspect_destinia_pacing_value').text(Number($('#aspect_destinia_pacing').val() || 0).toFixed(2));
    $('#aspect_destinia_threshold_value').text(Number($('#aspect_destinia_threshold').val() || 0).toFixed(2));
    $('#aspect_destinia_objective_threshold_value').text(`${Math.round(clamp01(Number($('#aspect_destinia_objective_threshold').val() || 0)) * 100)}%`);
}

function buildSettingsHtml() {
    return `
    <div id="${ROOT_ID}" class="aspect-destinia">
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
                <b>Aspect: Destinia</b>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
            </div>
            <div class="inline-drawer-content">
                <div class="aspect-destinia-panel">
                    <div class="aspect-destinia-card">
                        <div class="aspect-destinia-toolbar-top aspect-destinia-profile-controls">
                            <div class="aspect-destinia-field aspect-destinia-grow">
                                <div class="aspect-destinia-mini-heading">The Aspect of Destiny</div>
                                <label class="aspect-destinia-label">Profiles</label>
                                <div class="aspect-destinia-entry-picker-row">
                                    <div class="aspect-destinia-select-wrap">
                                        <select id="aspect_destinia_profile_select"></select>
                                        <span class="aspect-destinia-select-arrow">▾</span>
                                    </div>
                                    <button id="aspect_destinia_rename" class="menu_button aspect-destinia-icon-button" title="Rename profile" aria-label="Rename profile"><i class="fa-solid fa-pen" aria-hidden="true"></i></button>
                                </div>
                            </div>

                            <div class="aspect-destinia-field aspect-destinia-grow">
                                <label class="aspect-destinia-label">Current Chat</label>
                                <div class="aspect-destinia-inline">
                                    <select id="aspect_destinia_chat_select"></select>
                                </div>
                            </div>

                            <div class="aspect-destinia-toolbar aspect-destinia-profile-button-row">
                                <button id="aspect_destinia_create" class="menu_button">Create Profile for Current Chat</button>
                                <button id="aspect_destinia_attach_current" class="menu_button">Attach Current Chat</button>
                            </div>
                            <div class="aspect-destinia-toolbar aspect-destinia-profile-button-row">
                                <button id="aspect_destinia_save" class="menu_button menu_button_primary">Save Profile</button>
                                <button id="aspect_destinia_duplicate" class="menu_button">Duplicate Profile</button>
                                <button id="aspect_destinia_delete" class="menu_button menu_button_danger">Delete Profile</button>
                            </div>
                            <div class="aspect-destinia-toolbar aspect-destinia-profile-button-row">
                                <button id="aspect_destinia_export" class="menu_button">Export Profile</button>
                                <button id="aspect_destinia_import" class="menu_button">Import Profile</button>
                                <button id="aspect_destinia_clear_chat" class="menu_button menu_button_danger">Delete Current Chat Messages</button>
                            </div>
                            <input id="aspect_destinia_import_file" type="file" accept="application/json" class="aspect-destinia-hidden" />
                        </div>
                    </div>

                    <div class="aspect-destinia-card">
                        <div class="aspect-destinia-grid three">
                            <label class="checkbox_label"><input id="aspect_destinia_enabled" type="checkbox" /> Extension Enabled</label>
                            <label class="checkbox_label"><input id="aspect_destinia_auto_advance" type="checkbox" /> Auto-Advance Plot After Objective Threshold Met</label>
                            <label class="checkbox_label"><input id="aspect_destinia_foreshadow" type="checkbox" /> Foreshadow Next Plot Point</label>
                            <label class="checkbox_label"><input id="aspect_destinia_respect_intent" type="checkbox" /> Respect User Intended Plot Stagnation</label>
                            <div class="aspect-destinia-field">
                                <label class="aspect-destinia-label">Timeline Deviation</label>
                                <label class="checkbox_label"><input id="aspect_destinia_timeline_deviation_allowed" type="checkbox" /> Allowed</label>
                            </div>
                            <div class="aspect-destinia-field">
                                <label class="aspect-destinia-label">Auto-Resolve Deviation</label>
                                <label class="checkbox_label"><input id="aspect_destinia_auto_resolve_deviation" type="checkbox" /> Enabled</label>
                            </div>
                            <div class="aspect-destinia-field">
                                <label class="aspect-destinia-label">Story Progression</label>
                                <select id="aspect_destinia_mode">
                                    <option value="objectives">Objective-based rules</option>
                                    <option value="hints">Simple completion hints</option>
                                </select>
                            </div>
                            <div class="aspect-destinia-field">
                                <label class="aspect-destinia-label">Recent Messages Window (Evaluator Context)</label>
                                <input id="aspect_destinia_window" type="number" min="4" max="20" step="1" />
                            </div>
                            <div class="aspect-destinia-field">
                                <label class="aspect-destinia-label">Evaluator Connection Profile</label>
                                <select id="aspect_destinia_eval_connection"></select>
                            </div>
                            <div class="aspect-destinia-field">
                                <label class="aspect-destinia-label">Evaluator Chat Completion Preset</label>
                                <select id="aspect_destinia_eval_preset"></select>
                            </div>
                        </div>

                        <div class="aspect-destinia-grid three sliders">
                            <div class="aspect-destinia-field">
                                <label class="aspect-destinia-label">Strictness <span id="aspect_destinia_strictness_value"></span></label>
                                <input id="aspect_destinia_strictness" type="range" min="0" max="1" step="0.01" />
                            </div>
                            <div class="aspect-destinia-field">
                                <label class="aspect-destinia-label">Pacing Bias <span id="aspect_destinia_pacing_value"></span></label>
                                <input id="aspect_destinia_pacing" type="range" min="0" max="1" step="0.01" />
                            </div>
                            <div class="aspect-destinia-field">
                                <label class="aspect-destinia-label">Transition Threshold <span id="aspect_destinia_threshold_value"></span></label>
                                <input id="aspect_destinia_threshold" type="range" min="0.5" max="0.95" step="0.01" />
                            </div>
                            <div class="aspect-destinia-field">
                                <label class="aspect-destinia-label">Objective Auto-Advance Threshold <span id="aspect_destinia_objective_threshold_value"></span></label>
                                <input id="aspect_destinia_objective_threshold" type="range" min="0.5" max="1" step="0.05" />
                            </div>
                        </div>

                        <div class="aspect-destinia-actions">
                            <button id="aspect_destinia_prev" class="menu_button">Previous Plot Point</button>
                            <button id="aspect_destinia_next" class="menu_button">Next Plot Point</button>
                            <button id="aspect_destinia_reset_beat" class="menu_button">First Plot Point</button>
                        </div>
                    </div>

                    <div class="aspect-destinia-card">
                        <div class="aspect-destinia-section-title">Status</div>
                        <div id="aspect_destinia_status"></div>
                    </div>

                    <div class="aspect-destinia-card">
                        <div class="aspect-destinia-field">
                            <div class="aspect-destinia-label-row">
                                <div class="aspect-destinia-section-title">Timeline JSON</div>
                                <span class="aspect-destinia-warning-icon" data-validation-for="aspect_destinia_timeline" hidden title="">⚠️</span>
                            </div>
                            <textarea id="aspect_destinia_timeline" class="aspect-destinia-code"></textarea>
                        </div>
                        <div class="aspect-destinia-actions">
                            <button id="aspect_destinia_timeline_export" class="menu_button">Export</button>
                            <button id="aspect_destinia_timeline_import" class="menu_button">Import</button>
                            <input id="aspect_destinia_timeline_import_file" type="file" accept="application/json" class="aspect-destinia-hidden" />
                        </div>
                    </div>

                    <div class="aspect-destinia-card">
                        <div class="aspect-destinia-section-title">Injected Guidance Fields</div>

                        <div class="aspect-destinia-field">
                            <label class="aspect-destinia-label">Injection Intro</label>
                            <textarea id="aspect_destinia_prompt_intro"></textarea>
                        </div>

                        <div class="aspect-destinia-field">
                            <label class="aspect-destinia-label">Guidance Principles</label>
                            <textarea id="aspect_destinia_prompt_principles"></textarea>
                        </div>

                        <div class="aspect-destinia-grid two">
                            <div class="aspect-destinia-field">
                                <div class="aspect-destinia-label-row">
                                    <label class="aspect-destinia-label">Current Plot Point Template</label>
                                    <span class="aspect-destinia-warning-icon" data-validation-for="aspect_destinia_prompt_current" hidden title="">⚠️</span>
                                </div>
                                <textarea id="aspect_destinia_prompt_current"></textarea>
                            </div>
                            <div class="aspect-destinia-field">
                                <div class="aspect-destinia-label-row">
                                    <label class="aspect-destinia-label">Next Plot Point Template</label>
                                    <span class="aspect-destinia-warning-icon" data-validation-for="aspect_destinia_prompt_next" hidden title="">⚠️</span>
                                </div>
                                <textarea id="aspect_destinia_prompt_next"></textarea>
                            </div>
                        </div>

                        <div class="aspect-destinia-field">
                            <div class="aspect-destinia-label-row">
                                <label class="aspect-destinia-label">Transition Template</label>
                                <span class="aspect-destinia-warning-icon" data-validation-for="aspect_destinia_prompt_transition" hidden title="">⚠️</span>
                            </div>
                            <textarea id="aspect_destinia_prompt_transition"></textarea>
                        </div>

                        <div class="aspect-destinia-grid two">
                            <div class="aspect-destinia-field">
                                <div class="aspect-destinia-label-row">
                                    <label class="aspect-destinia-label">Objective Mode Template</label>
                                    <span class="aspect-destinia-warning-icon" data-validation-for="aspect_destinia_prompt_objectives" hidden title="">⚠️</span>
                                </div>
                                <textarea id="aspect_destinia_prompt_objectives"></textarea>
                            </div>
                            <div class="aspect-destinia-field">
                                <div class="aspect-destinia-label-row">
                                    <label class="aspect-destinia-label">Hint Mode Template</label>
                                    <span class="aspect-destinia-warning-icon" data-validation-for="aspect_destinia_prompt_hints" hidden title="">⚠️</span>
                                </div>
                                <textarea id="aspect_destinia_prompt_hints"></textarea>
                            </div>
                        </div>

                        <div class="aspect-destinia-grid two">
                            <div class="aspect-destinia-field">
                                <label class="aspect-destinia-label">Linger Instruction</label>
                                <textarea id="aspect_destinia_prompt_linger"></textarea>
                            </div>
                            <div class="aspect-destinia-field">
                                <label class="aspect-destinia-label">Advance Instruction</label>
                                <textarea id="aspect_destinia_prompt_advance"></textarea>
                            </div>
                        </div>

                        <div class="aspect-destinia-field">
                            <div class="aspect-destinia-label-row">
                                <label class="aspect-destinia-label">Pacing Instruction</label>
                                <span class="aspect-destinia-warning-icon" data-validation-for="aspect_destinia_prompt_pacing" hidden title="">⚠️</span>
                            </div>
                            <textarea id="aspect_destinia_prompt_pacing"></textarea>
                        </div>

                        <div class="aspect-destinia-field">
                            <div class="aspect-destinia-label-row">
                                <label class="aspect-destinia-label">Objective Completion Guidance</label>
                                <span class="aspect-destinia-warning-icon" data-validation-for="aspect_destinia_prompt_objective_guidance" hidden title="">⚠️</span>
                            </div>
                            <textarea id="aspect_destinia_prompt_objective_guidance"></textarea>
                        </div>

                        <div class="aspect-destinia-field">
                            <div class="aspect-destinia-label-row">
                                <label class="aspect-destinia-label">Evaluator Prompt</label>
                                <span class="aspect-destinia-warning-icon" data-validation-for="aspect_destinia_prompt_evaluator" hidden title="">⚠️</span>
                            </div>
                            <textarea id="aspect_destinia_prompt_evaluator" class="aspect-destinia-code tall"></textarea>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>`;
}

function bindUI() {
    $('#aspect_destinia_profile_select').on('change', () => {
        const profileId = $('#aspect_destinia_profile_select').val();
        setSelectedProfileId(profileId);
        const profile = getProfileById(profileId);
        profileToForm(profile);
    });

    bindDebouncedButtonAction('#aspect_destinia_create', createProfileAttachedToCurrentChat);
    bindDebouncedButtonAction('#aspect_destinia_rename', renameDisplayedProfile, { showBusy: false, debounceMs: 120 });
    bindDebouncedButtonAction('#aspect_destinia_duplicate', duplicateSelectedProfile);
    bindDebouncedButtonAction('#aspect_destinia_delete', deleteSelectedProfile);
    bindDebouncedButtonAction('#aspect_destinia_attach_current', attachSelectedProfileToCurrentChat);
    bindDebouncedButtonAction('#aspect_destinia_save', saveDisplayedProfile);
    bindDebouncedButtonAction('#aspect_destinia_export', exportDisplayedProfileToFile);
    bindDebouncedButtonAction('#aspect_destinia_import', () => $('#aspect_destinia_import_file').trigger('click'), { showBusy: false });
    $('#aspect_destinia_import_file').on('change', importProfileFromFile);

    bindDebouncedButtonAction('#aspect_destinia_timeline_export', exportTimelineToFile);
    bindDebouncedButtonAction('#aspect_destinia_timeline_import', () => $('#aspect_destinia_timeline_import_file').trigger('click'), { showBusy: false });
    $('#aspect_destinia_timeline_import_file').on('change', importTimelineFromFile);

    bindDebouncedButtonAction('#aspect_destinia_prev', () => stepBeat(-1), { showBusy: false, debounceMs: 120 });
    bindDebouncedButtonAction('#aspect_destinia_next', () => stepBeat(1), { showBusy: false, debounceMs: 120 });
    bindDebouncedButtonAction('#aspect_destinia_reset_beat', resetCurrentBeatToFirst, { showBusy: false, debounceMs: 120 });
    bindDebouncedButtonAction('#aspect_destinia_clear_chat', clearCurrentChatMessages);

    $('#aspect_destinia_strictness, #aspect_destinia_pacing, #aspect_destinia_threshold, #aspect_destinia_objective_threshold').on('input', updateSliderDisplays);
    $(Object.keys(TEMPLATE_VALIDATION_RULES).map(id => `#${id}`).join(', ')).on('input change', updateFieldValidationIndicators);

    addFieldResetButtons();
    updateFieldValidationIndicators();
}

function renderRoot() {
    if (document.getElementById(ROOT_ID)) return;
    $('#extensions_settings').append(buildSettingsHtml());

    ensureBusyIndicator();
    bindUI();
    refreshUI();
}

function onChatChanged() {
    registerKnownChat();
    refreshUI();
    updateExtensionPrompt();
    renderDiagnosticForLatestAssistantMessage();
}

function bindEvents() {
    const ctx = getCtx();
    ctx.eventSource.on(ctx.event_types.CHAT_CHANGED, onChatChanged);
    ctx.eventSource.on(ctx.event_types.MESSAGE_SENT, async () => {
        await evaluateIntentIfNeeded('user message');
    });
    ctx.eventSource.on(ctx.event_types.MESSAGE_RECEIVED, async () => {
        await evaluateIntentIfNeeded('assistant message');
        renderDiagnosticForLatestAssistantMessage();
    });
    ctx.eventSource.on(ctx.event_types.APP_READY, () => {
        renderRoot();
    });
}

jQuery(async () => {
    ensureSettings();
    registerKnownChat();
    renderRoot();
    bindEvents();

    const linkedId = getLinkedProfileIdForCurrentChat();
    if (linkedId) {
        setSelectedProfileId(linkedId);
    }

    refreshUI();
    updateExtensionPrompt();
    renderDiagnosticForLatestAssistantMessage();
    console.log(`[${MODULE_NAME}] loaded`);
});
