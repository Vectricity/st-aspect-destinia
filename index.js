const MODULE_ID = 'st-aspect-destinia';
const MODULE_NAME = 'Aspect: Destinia';
const ROOT_ID = 'aspect_destinia_root';
const EXTENSION_PROMPT_KEY = 'aspect_destinia_prompt';
// Prefer evaluator-model checks first; only fall back to local heuristics when backend limitations occur.
let remoteIntentEvalDisabled = false;
let latestObjectiveEvaluationReport = null;
let uiBusyCounter = 0;


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
                { text: 'Preserve continuity from the prior beat.', completed: false },
                { text: 'Let the user influence how the transition feels.', completed: false }
            ],
            completionHints: [
                'The escalation is now active in the story.',
                'Key consequences or reactions have begun.',
                'The cast is no longer grounded in the previous beat.'
            ],
            steeringPrompt: 'Transition naturally into the escalation without making the shift feel abrupt or forced.',
            transitionGuidance: 'Introduce the escalation setup and consequence chain before diving into direct conflict beats.',
            pace: 'medium',
            delayable: true
        }
    ]
};

const DEFAULT_PROFILE = Object.freeze({
    id: '',
    entryName: 'New Entry',
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
                'Guide the narrative toward the active story beat while preserving immersion, natural character behavior, and the user’s roleplay agency.',
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
                'Current beat index: {{current_index}} / {{total_beats}}',
                'Current beat title: {{current_title}}',
                'Current beat summary: {{current_summary}}',
                'Current beat steering: {{current_steering}}',
                'Current beat pace: {{current_pace}}'
            ].join('\n'),

        transitionTemplate:
            [
                'Transition requirements from current beat to next beat:',
                '{{transition_requirements}}'
            ].join('\n'),

        objectiveModeTemplate:
            [
                'Use objective-based progression rules for the current beat.',
                'Current beat objectives:',
                '{{current_objectives}}'
            ].join('\n'),

        hintModeTemplate:
            [
                'Use simple completion hints for the current beat.',
                'Current beat completion hints:',
                '{{current_hints}}'
            ].join('\n'),

        nextBeatTemplate:
            [
                'Next beat title: {{next_title}}',
                'Next beat summary: {{next_summary}}',
                'Only foreshadow or transition toward it when the current beat is ready and the user’s roleplay direction supports it.'
            ].join('\n'),

        lingerInstruction:
            'Current user-direction signal: remain within the present beat. Let the current scene breathe, deepen, and unfold without prematurely transitioning.',

        advanceInstruction:
            'Current user-direction signal: allow movement toward the next beat. Transition smoothly through natural consequences rather than abrupt narration.',

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
                'Read the recent chat and determine whether the USER is signaling that the story should stay on the current beat or may transition toward the next beat.',
                'Only mark objectives complete when the USER meaningfully demonstrates progress. Do not mark completion based only on assistant/NPC narration or dialogue.',
                'Only mark user_wants_to_linger as true when the user explicitly asks to delay progression, is clearly still working an unfinished in-beat task, or is engaged in an important unresolved conversation. Ordinary banter or casual dialogue alone is not lingering intent.',
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
                'Current beat: {{current_title}}',
                'Current beat summary: {{current_summary}}',
                'Current beat objectives: {{current_objectives_inline}}',
                'Current beat objective completion booleans: {{current_objective_completion_inline}}',
                'Current beat completion hints: {{current_hints_inline}}',
                'Next beat: {{next_title}}',
                'Recent USER-only chat (primary evidence for objective completion):',
                '{{recent_user_chat}}',
                'Recent chat:',
                '{{recent_chat}}'
            ].join('\n'),

        objectiveTemplateEvaluatorPrompt:
            [
                'You are reviewing story-beat objectives for quality and actionability.',
                'Evaluate each objective and decide whether it is problematic for practical in-scene tracking.',
                'Mark problematic when an objective is vague, too broad, overloaded with multiple actions, or not directly observable.',
                'For problematic objectives, include 1-3 rewritten objective lines that are concrete and measurable in scene play.',
                'Return ONLY valid JSON with this schema:',
                '{',
                '  "evaluations": [',
                '    {',
                '      "point_index": 0,',
                '      "objective_index": 0,',
                '      "is_problem": true,',
                '      "issues": ["vague", "complicated"],',
                '      "reason": "short reason",',
                '      "suggested_rewrites": ["objective line"]',
                '    }',
                '  ]',
                '}',
                'Allowed issue labels: vague, complicated, generalized, not_observable.',
                'If objective is good, set is_problem to false and suggested_rewrites to [].',
                'Timeline JSON:',
                '{{timeline_json}}'
            ].join('\n'),

        objectiveTemplateFixerPrompt:
            [
                'Rewrite the objective below into concrete, observable beat objectives.',
                'Return ONLY valid JSON:',
                '{ "rewrites": ["objective 1", "objective 2"] }',
                'Rules:',
                '- Keep story intent aligned with beat title and beat summary.',
                '- Prefer one clear action per objective line.',
                '- 1 to 3 rewrites only.',
                '- Avoid vague terms like "improve", "handle", or "progress" without specifics.',
                'Beat title: {{beat_title}}',
                'Beat summary: {{beat_summary}}',
                'Original objective: {{objective_text}}'
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
            transitionGuidance: transitionGuidance || 'Show the causal bridge from this beat into the next beat before the next beat action fully begins.'
        };
    });
    return timeline;
}

function getObjectiveCompletionThreshold(profile) {
    return clamp01(Number(profile?.objectiveAutoAdvanceThreshold ?? 0.8));
}

function classifyObjectiveIssues(objectiveText) {
    const text = String(objectiveText || '').trim();
    if (!text) {
        return [{ type: 'vague', message: 'Objective text is empty.' }];
    }

    const issues = [];
    const words = text.split(/\s+/).filter(Boolean);
    const vagueStarts = /^(improve|handle|deal with|work on|progress|advance|develop|resolve)\b/i;
    const vaguePhrases = /\b(something|somehow|etc\.?|and more|as needed|overall|in general|everything|anything|stuff)\b/i;
    const broadPhrases = /\b(entire|all(?:\s+of)?|every(?:thing)?|the whole|worldbuilding|storyline|main plot|character development|relationships|narrative arc)\b/i;
    const splitSignals = /\b(and|then|while|meanwhile|plus|also|before|after)\b/i;
    const measurableActionSignal = /\b(show|reveal|establish|decide|confirm|identify|choose|confront|admit|discover|resolve|agree|refuse|learn|find|state|demonstrate)\b/i;

    if (words.length > 24 || /[,;:].+[,;:]/.test(text) || (splitSignals.test(text) && words.length > 10)) {
        issues.push({ type: 'complicated', message: 'Objective combines too many actions and should be split.' });
    }
    if (words.length < 4 || vagueStarts.test(text) || vaguePhrases.test(text) || !measurableActionSignal.test(text)) {
        issues.push({ type: 'vague', message: 'Objective is too vague and should be more specific.' });
    }
    if (broadPhrases.test(text)) {
        issues.push({ type: 'generalized', message: 'Objective is too broad/generalized for one beat.' });
    }

    return issues;
}

function buildObjectiveFixes(objectiveText) {
    const source = String(objectiveText || '').trim();
    if (!source) {
        return ['Define one concrete, observable action for this beat.'];
    }

    const normalizeSentence = (text) => text
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/^[a-z]/, c => c.toUpperCase())
        .replace(/[.!?]*$/g, '.');

    const splitCandidates = source
        .split(/\s*;\s*/)
        .map(part => part.trim())
        .filter(Boolean);

    const actionableVerb = /\b(establish|introduce|surface|create|allow|show|reveal|confirm|decide|identify|choose|confront|admit|discover|resolve|agree|refuse|learn|find|state|demonstrate|deepen|highlight)\b/i;
    const clauses = splitCandidates.length > 1 ? splitCandidates : [source];

    return clauses
        .map((clause) => {
            const compact = clause.replace(/\s+/g, ' ').trim();
            if (!compact) return null;

            if (compact.split(/\s+/).length < 5 || !actionableVerb.test(compact)) {
                return normalizeSentence(`Show one concrete in-scene action that demonstrates: ${compact.replace(/[.!?]+$/g, '')}`);
            }

            return normalizeSentence(compact);
        })
        .filter(Boolean)
        .slice(0, 3);
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
    const payload = {
        quietPrompt,
        connectionProfile: profile?.llmConnectionProfile || undefined,
        connection_profile: profile?.llmConnectionProfile || undefined,
        chatCompletionPreset: profile?.llmPreset || undefined,
        chat_completion_preset: profile?.llmPreset || undefined,
        preset: profile?.llmPreset || undefined
    };

    Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key]);
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
    if (document.getElementById('aspect_destinia_busy_indicator')) return;
    document.body.insertAdjacentHTML('beforeend', `
        <div id="aspect_destinia_busy_indicator" class="aspect-destinia-busy-indicator" aria-hidden="true">
            <i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>
            <span>Processing…</span>
        </div>
    `);
}

function setBusyIndicatorVisible(visible) {
    ensureBusyIndicator();
    const el = document.getElementById('aspect_destinia_busy_indicator');
    if (!el) return;
    el.classList.toggle('open', Boolean(visible));
    el.setAttribute('aria-hidden', visible ? 'false' : 'true');
}

async function withBusyIndicator(task) {
    uiBusyCounter += 1;
    setBusyIndicatorVisible(true);
    try {
        return await task();
    } finally {
        uiBusyCounter = Math.max(0, uiBusyCounter - 1);
        if (uiBusyCounter === 0) {
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

function closeObjectiveReportModal() {
    $('#aspect_destinia_objective_report_modal').removeClass('open').attr('aria-hidden', 'true');
}

function renderObjectiveEvaluationReportModal() {
    const modal = $('#aspect_destinia_objective_report_modal');
    const body = $('#aspect_destinia_objective_report_body');
    if (!modal.length || !body.length) return;

    const report = latestObjectiveEvaluationReport;
    if (!report) {
        body.html('<div class="aspect-destinia-objective-report-empty">No evaluation report yet. Run Evaluate Objectives first.</div>');
        return;
    }

    if (!report.issues.length) {
        body.html('<div class="aspect-destinia-objective-report-empty">No objective issues were found in the latest evaluation.</div>');
        return;
    }

    const rows = report.issues.map((issue, reportIndex) => {
        const issueLabels = issue.issues?.length
            ? issue.issues.map(item => escapeHtml(item.type || item.message || 'issue')).join(', ')
            : 'unspecified';
        const reason = issue.reason ? `<div class="aspect-destinia-objective-report-reason">${escapeHtml(issue.reason)}</div>` : '';
        return `
            <div class="aspect-destinia-objective-report-item">
                <div class="aspect-destinia-objective-report-item-head">
                    <div>
                        <strong>${escapeHtml(issue.beatTitle)}</strong>
                        <div class="aspect-destinia-objective-report-meta">Objective #${issue.objectiveIdx + 1}</div>
                    </div>
                    <button class="menu_button aspect-destinia-icon-action" data-report-index="${reportIndex}" title="Fix this objective">🔧</button>
                </div>
                <div class="aspect-destinia-objective-report-objective">${escapeHtml(issue.objectiveText)}</div>
                <div class="aspect-destinia-objective-report-meta">Issues: ${issueLabels}</div>
                ${reason}
            </div>
        `;
    }).join('');

    body.html(rows);
}

function openObjectiveEvaluationReportModal() {
    renderObjectiveEvaluationReportModal();
    $('#aspect_destinia_objective_report_modal').addClass('open').attr('aria-hidden', 'false');
}

function setLatestObjectiveEvaluationReport(report) {
    latestObjectiveEvaluationReport = report
        ? {
            parsed: report.parsed,
            issues: Array.isArray(report.issues) ? report.issues : [],
            source: report.source || 'heuristic',
            timelineSnapshot: $('#aspect_destinia_timeline').val() || ''
        }
        : null;
}

async function evaluateTemplateObjectivesFromInput(notifyWhenHealthy = true) {
    const parsed = safeParseTimeline($('#aspect_destinia_timeline').val());
    if (!parsed) {
        toastr.error(`${MODULE_NAME}: cannot evaluate objectives because timeline JSON is invalid.`);
        return null;
    }

    const issues = [];
    const profile = getDisplayedProfile() || getActiveProfile();
    let llmEvaluations = [];
    let evaluationSource = 'heuristic';
    if (profile) {
        try {
            const ctx = getCtx();
            const prompt = replaceMacros(profile.prompts?.objectiveTemplateEvaluatorPrompt || '', {
                timeline_json: JSON.stringify(parsed, null, 2)
            });
            const result = await generateQuietPromptWithEvaluatorModel(ctx, profile, prompt);
            const parsedResult = parseJsonObject(result);
            if (Array.isArray(parsedResult?.evaluations)) {
                llmEvaluations = parsedResult.evaluations;
                evaluationSource = 'llm';
            }
        } catch (err) {
            console.warn(`[${MODULE_NAME}] objective evaluator model failed; using heuristic fallback`, err);
        }
    }

    if (evaluationSource === 'llm') {
        for (const row of llmEvaluations) {
            const pointIdx = Number(row?.point_index);
            const objectiveIdx = Number(row?.objective_index);
            if (!Number.isInteger(pointIdx) || !Number.isInteger(objectiveIdx)) continue;

            const point = parsed.plotPoints?.[pointIdx];
            const objective = normalizeObjectiveItem(point?.objectives?.[objectiveIdx]);
            if (!point || !objective.text) continue;

            if (parseBooleanLike(row?.is_problem, false)) {
                issues.push({
                    pointIdx,
                    objectiveIdx,
                    beatTitle: point.title || `Beat ${pointIdx + 1}`,
                    objectiveText: objective.text || '(empty objective)',
                    issues: normalizeObjectiveEvaluationIssueLabels(row?.issues),
                    reason: String(row?.reason || '').trim(),
                    suggestedRewrites: Array.isArray(row?.suggested_rewrites)
                        ? row.suggested_rewrites.map(item => String(item || '').trim()).filter(Boolean).slice(0, 3)
                        : []
                });
            }
        }
    } else {
        parsed.plotPoints.forEach((point, pointIdx) => {
            const objectives = Array.isArray(point.objectives) ? point.objectives.map(normalizeObjectiveItem) : [];
            objectives.forEach((objective, objectiveIdx) => {
                const objectiveIssues = classifyObjectiveIssues(objective.text);
                if (objectiveIssues.length) {
                    issues.push({
                        pointIdx,
                        objectiveIdx,
                        beatTitle: point.title || `Beat ${pointIdx + 1}`,
                        objectiveText: objective.text || '(empty objective)',
                        issues: objectiveIssues,
                        reason: 'Heuristic fallback evaluation.',
                        suggestedRewrites: []
                    });
                }
            });
        });
    }

    const report = { parsed, issues, source: evaluationSource };
    setLatestObjectiveEvaluationReport(report);

    if (!issues.length) {
        if (notifyWhenHealthy) {
            toastr.success(`${MODULE_NAME}: no vague or overly complicated objectives detected.`);
        }
        return report;
    }

    const evalMethod = evaluationSource === 'llm' ? 'LLM evaluator' : 'heuristic fallback';
    toastr.warning(`${MODULE_NAME}: found ${issues.length} objective issue(s) via ${evalMethod}. Open View Report to review details.`);
    return report;
}

async function buildObjectiveFixesWithModel(profile, beat, objectiveText, seedSuggestions = []) {
    if (seedSuggestions.length) {
        return seedSuggestions.slice(0, 3);
    }

    try {
        const ctx = getCtx();
        const prompt = replaceMacros(profile.prompts?.objectiveTemplateFixerPrompt || '', {
            beat_title: beat?.title || '',
            beat_summary: beat?.summary || '',
            objective_text: objectiveText || ''
        });
        const result = await generateQuietPromptWithEvaluatorModel(ctx, profile, prompt);
        const parsed = parseJsonObject(result);
        if (Array.isArray(parsed?.rewrites)) {
            const rewrites = parsed.rewrites.map(item => String(item || '').trim()).filter(Boolean).slice(0, 3);
            if (rewrites.length) return rewrites;
        }
    } catch (err) {
        console.warn(`[${MODULE_NAME}] objective fixer model failed; using heuristic fallback`, err);
    }

    return buildObjectiveFixes(objectiveText);
}

function getLatestObjectiveEvaluationReport() {
    if (!latestObjectiveEvaluationReport) {
        toastr.warning(`${MODULE_NAME}: run Evaluate Objectives first to create a report.`);
        return null;
    }

    const currentTimeline = $('#aspect_destinia_timeline').val() || '';
    if (latestObjectiveEvaluationReport.timelineSnapshot !== currentTimeline) {
        toastr.warning(`${MODULE_NAME}: timeline changed since evaluation. Re-run Evaluate Objectives first.`);
        return null;
    }

    return latestObjectiveEvaluationReport;
}

function removeFixedIssueFromLatestReport(reportIndex) {
    if (!latestObjectiveEvaluationReport || !Array.isArray(latestObjectiveEvaluationReport.issues)) return;
    latestObjectiveEvaluationReport.issues.splice(reportIndex, 1);
}

async function fixSingleIssueFromReport(issue, parsed, profile) {
    const point = parsed.plotPoints?.[issue.pointIdx];
    if (!point || !Array.isArray(point.objectives)) return false;

    const original = normalizeObjectiveItem(point.objectives[issue.objectiveIdx]);
    if (!original.text) return false;

    const fixes = profile
        ? await buildObjectiveFixesWithModel(profile, point, original.text, issue.suggestedRewrites || [])
        : buildObjectiveFixes(original.text);
    if (!fixes.length) return false;

    const fixedEntries = fixes.map(text => ({ text, completed: false }));
    point.objectives.splice(issue.objectiveIdx, 1, ...fixedEntries);
    return true;
}

async function fixTemplateObjectivesFromInput() {
    const report = getLatestObjectiveEvaluationReport();
    if (!report) return;

    const parsed = safeParseTimeline($('#aspect_destinia_timeline').val());
    if (!parsed) {
        toastr.error(`${MODULE_NAME}: cannot fix objectives because timeline JSON is invalid.`);
        return;
    }

    if (!report.issues.length) {
        toastr.success(`${MODULE_NAME}: no objective fixes needed.`);
        return;
    }

    const sortedIssues = [...report.issues].sort((a, b) => {
        if (a.pointIdx !== b.pointIdx) return b.pointIdx - a.pointIdx;
        return b.objectiveIdx - a.objectiveIdx;
    });

    let replacements = 0;
    const profile = getDisplayedProfile() || getActiveProfile();
    for (const issue of sortedIssues) {
        const applied = await fixSingleIssueFromReport(issue, parsed, profile);
        if (applied) replacements += 1;
    }

    $('#aspect_destinia_timeline').val(JSON.stringify(parsed, null, 2));
    setLatestObjectiveEvaluationReport(null);
    toastr.success(`${MODULE_NAME}: fixed ${replacements} objective(s) from the latest report.`);
}

async function fixSingleObjectiveFromReportIndex(reportIndex) {
    const report = getLatestObjectiveEvaluationReport();
    if (!report) return;

    const issue = report.issues[reportIndex];
    if (!issue) {
        toastr.warning(`${MODULE_NAME}: selected report item is no longer available.`);
        return;
    }

    const parsed = safeParseTimeline($('#aspect_destinia_timeline').val());
    if (!parsed) {
        toastr.error(`${MODULE_NAME}: cannot fix objective because timeline JSON is invalid.`);
        return;
    }

    const profile = getDisplayedProfile() || getActiveProfile();
    const applied = await fixSingleIssueFromReport(issue, parsed, profile);
    if (!applied) {
        toastr.warning(`${MODULE_NAME}: unable to fix the selected objective.`);
        return;
    }

    $('#aspect_destinia_timeline').val(JSON.stringify(parsed, null, 2));
    removeFixedIssueFromLatestReport(reportIndex);
    renderObjectiveEvaluationReportModal();
    toastr.success(`${MODULE_NAME}: fixed 1 objective from the latest report.`);
}

function formatObjectives(items) {
    if (!Array.isArray(items) || items.length === 0) return '- none';
    return items.map(item => {
        const objective = normalizeObjectiveItem(item);
        const marker = objective.completed ? '[x]' : '[ ]';
        return `- ${marker} ${objective.text}`;
    }).join('\n');
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
        next_summary: next.summary || 'No next beat.',
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
        if (notify) toastr.warning(`${MODULE_NAME}: no enabled active entry for this chat.`);
        return;
    }
    if (!force && !profile.autoAdvance && !profile.respectUserIntent) {
        if (notify) toastr.warning(`${MODULE_NAME}: enable auto-advance or respect intent to run intent checks.`);
        return;
    }

    const currentBeat = getCurrentBeat(profile);
    if (!currentBeat) {
        if (notify) toastr.warning(`${MODULE_NAME}: no current beat is available.`);
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
            nextBeatSummary: getNextBeat(profile)?.summary || 'No next beat.'
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
            toastr.info(`${MODULE_NAME}: moved to "${newBeat?.title || 'next beat'}".`);
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
                <div><b class="aspect-destinia-diagnostic-sand">Current story beat:</b> ${escapeHtml(current?.title || 'None')}</div>
                <div><b class="aspect-destinia-diagnostic-sand">Next story beat:</b> ${escapeHtml(next?.title || 'None')}</div>
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
        entryName: `Entry for ${chatLabel}`,
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
    toastr.success(`${MODULE_NAME}: created entry and attached it to the current chat.`);
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
    toastr.info(`${MODULE_NAME}: deleted entry "${profile.entryName}".`);
    refreshUI();
}

function duplicateSelectedProfile() {
    const profile = getDisplayedProfile();
    if (!profile) return;

    const copy = structuredClone(profile);
    copy.id = makeId('entry');
    copy.entryName = `${profile.entryName} (Copy)`;

    getProfiles().push(copy);
    setSelectedProfileId(copy.id);
    saveSettings();
    toastr.success(`${MODULE_NAME}: duplicated entry.`);
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
    toastr.success(`${MODULE_NAME}: attached selected entry to the current chat.`);
    refreshUI();
}

function getDisplayedProfile() {
    const selectedId = $('#aspect_destinia_profile_select').val() || getLinkedProfileIdForCurrentChat() || getSelectedProfileId();
    if (!selectedId) return null;
    return getProfileById(selectedId);
}

function profileToForm(profile) {
    if (!profile) {
        clearForm();
        return;
    }

    $('#aspect_destinia_profile_select').val(profile.id);
    $('#aspect_destinia_entry_name').val(profile.entryName || 'Untitled Entry');
    $('#aspect_destinia_enabled').prop('checked', !!profile.enabled);
    $('#aspect_destinia_mode').val(profile.advancementMode || 'objectives');
    $('#aspect_destinia_auto_advance').prop('checked', !!profile.autoAdvance);
    $('#aspect_destinia_foreshadow').prop('checked', !!profile.foreshadowNextBeat);
    $('#aspect_destinia_respect_intent').prop('checked', !!profile.respectUserIntent);
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
    $('#aspect_destinia_prompt_objective_template_evaluator').val(profile.prompts.objectiveTemplateEvaluatorPrompt || '');
    $('#aspect_destinia_prompt_objective_template_fixer').val(profile.prompts.objectiveTemplateFixerPrompt || '');

    renderStatus(profile);
}

function clearForm() {
    $('#aspect_destinia_entry_name').val('');
    $('#aspect_destinia_enabled').prop('checked', true);
    $('#aspect_destinia_mode').val('objectives');
    $('#aspect_destinia_auto_advance').prop('checked', true);
    $('#aspect_destinia_foreshadow').prop('checked', true);
    $('#aspect_destinia_respect_intent').prop('checked', true);
    $('#aspect_destinia_strictness').val(0.55);
    $('#aspect_destinia_pacing').val(0.45);
    $('#aspect_destinia_threshold').val(0.72);
    $('#aspect_destinia_objective_threshold').val(0.8);
    $('#aspect_destinia_window').val(8);
    $('#aspect_destinia_eval_connection').val('');
    $('#aspect_destinia_eval_preset').val('');
    $('#aspect_destinia_chat_select').val('');
    $('#aspect_destinia_timeline').val(JSON.stringify(DEFAULT_TIMELINE_TEMPLATE, null, 2));
}

function formToProfile(profile) {
    const parsedTimeline = safeParseTimeline($('#aspect_destinia_timeline').val());
    if (!parsedTimeline) {
        throw new Error('Timeline JSON must be valid and include plotPoints[].');
    }

    profile.entryName = $('#aspect_destinia_entry_name').val().trim() || profile.entryName || 'Untitled Entry';
    profile.enabled = $('#aspect_destinia_enabled').is(':checked');
    profile.advancementMode = $('#aspect_destinia_mode').val();
    profile.autoAdvance = $('#aspect_destinia_auto_advance').is(':checked');
    profile.foreshadowNextBeat = $('#aspect_destinia_foreshadow').is(':checked');
    profile.respectUserIntent = $('#aspect_destinia_respect_intent').is(':checked');
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
    profile.prompts.objectiveTemplateEvaluatorPrompt = $('#aspect_destinia_prompt_objective_template_evaluator').val();
    profile.prompts.objectiveTemplateFixerPrompt = $('#aspect_destinia_prompt_objective_template_fixer').val();

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
        toastr.warning(`${MODULE_NAME}: no selected entry to export.`);
        return;
    }

    downloadJsonToFile(profile, `${profile.entryName || 'destinia_entry'}_entry`);
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
            imported.entryName = `${imported.entryName || 'Imported Entry'} (Imported)`;
            imported.timeline = normalizeTimeline(imported.timeline || safeParseTimeline(imported.timelineText) || structuredClone(DEFAULT_TIMELINE_TEMPLATE));
            imported.timelineText = JSON.stringify(imported.timeline, null, 2);
            getProfiles().push(imported);
            persistProfile(imported);
            setSelectedProfileId(imported.id);
            refreshUI();
            toastr.success(`${MODULE_NAME}: imported entry from file.`);
        } catch (err) {
            toastr.error(`${MODULE_NAME}: failed to import entry (${err.message}).`);
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
    aspect_destinia_prompt_objective_template_evaluator: () => DEFAULT_PROFILE.prompts.objectiveTemplateEvaluatorPrompt,
    aspect_destinia_prompt_objective_template_fixer: () => DEFAULT_PROFILE.prompts.objectiveTemplateFixerPrompt,
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
        toastr.warning(`${MODULE_NAME}: create an entry first.`);
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
        toastr.success(`${MODULE_NAME}: saved settings to "${profile.entryName}".`);
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
    profile.state.lastIntentReason = 'Manually reset to the first beat.';
    persistProfile(profile);
    updateExtensionPrompt();
    toastr.info(`${MODULE_NAME}: reset current beat to the first plot point.`);
    refreshUI();
}

function stepBeat(delta) {
    const profile = getDisplayedProfile();
    if (!profile) return;

    const timeline = getActiveTimeline(profile);
    const max = Math.max(0, (timeline?.plotPoints?.length || 1) - 1);
    profile.state.currentIndex = Math.max(0, Math.min(max, (profile.state.currentIndex || 0) + delta));
    profile.state.lastIntentReason = `Manually adjusted current beat to index ${profile.state.currentIndex + 1}.`;
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
                : '<div class="aspect-destinia-empty">No objectives on this beat.</div>'}
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
    select.append(`<option value="">-- Select Entry --</option>`);
    for (const profile of profiles) {
        select.append(`<option value="${escapeHtml(profile.id)}">${escapeHtml(profile.entryName)}</option>`);
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
        $('#aspect_destinia_status').html('<div class="aspect-destinia-empty">No entry selected. Create one to bind story progression to this chat.</div>');
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
                        <div class="aspect-destinia-toolbar">
                            <div class="aspect-destinia-field aspect-destinia-grow">
                                <label class="aspect-destinia-label">Entry</label>
                                <div class="aspect-destinia-entry-picker-row">
                                    <div class="aspect-destinia-select-wrap">
                                        <select id="aspect_destinia_profile_select"></select>
                                        <span class="aspect-destinia-select-arrow">▾</span>
                                    </div>
                                </div>
                                <input id="aspect_destinia_entry_name" type="text" placeholder="Entry name" />
                            </div>
                            <button id="aspect_destinia_save" class="menu_button menu_button_primary">Save</button>
                            <button id="aspect_destinia_create" class="menu_button">Create for Current Chat</button>
                            <button id="aspect_destinia_duplicate" class="menu_button">Duplicate</button>
                            <button id="aspect_destinia_delete" class="menu_button menu_button_danger">Delete</button>
                            <button id="aspect_destinia_export" class="menu_button">Export</button>
                            <button id="aspect_destinia_import" class="menu_button">Import</button>
                            <input id="aspect_destinia_import_file" type="file" accept="application/json" class="aspect-destinia-hidden" />
                        </div>
                    </div>

                    <div class="aspect-destinia-card">
                        <div class="aspect-destinia-grid two">
                            <div class="aspect-destinia-field">
                                <label class="aspect-destinia-label">Attached Chat</label>
                                <div class="aspect-destinia-inline">
                                    <select id="aspect_destinia_chat_select"></select>
                                    <button id="aspect_destinia_attach_current" class="menu_button">Use Current Chat</button>
                                </div>
                            </div>
                        </div>

                        <div class="aspect-destinia-grid three">
                            <label class="checkbox_label"><input id="aspect_destinia_enabled" type="checkbox" /> Extension Enabled</label>
                            <label class="checkbox_label"><input id="aspect_destinia_auto_advance" type="checkbox" /> Auto-Advance Plot After Objective Threshold Met</label>
                            <label class="checkbox_label"><input id="aspect_destinia_foreshadow" type="checkbox" /> Foreshadow Next Plot Point</label>
                            <label class="checkbox_label"><input id="aspect_destinia_respect_intent" type="checkbox" /> Respect User Intended Plot Stagnation</label>
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
                            <button id="aspect_destinia_clear_chat" class="menu_button menu_button_danger">Delete Current Chat Messages</button>
                        </div>
                    </div>

                    <div class="aspect-destinia-card">
                        <div class="aspect-destinia-section-title">Status</div>
                        <div id="aspect_destinia_status"></div>
                    </div>

                    <div class="aspect-destinia-card">
                        <div class="aspect-destinia-section-title">Timeline JSON</div>
                        <textarea id="aspect_destinia_timeline" class="aspect-destinia-code"></textarea>
                        <div class="aspect-destinia-actions">
                            <button id="aspect_destinia_validate" class="menu_button">Validate Timeline JSON</button>
                            <button id="aspect_destinia_timeline_export" class="menu_button">Export</button>
                            <button id="aspect_destinia_timeline_import" class="menu_button">Import</button>
                            <button id="aspect_destinia_eval_objectives" class="menu_button">Evaluate Objectives</button>
                            <button id="aspect_destinia_fix_objectives" class="menu_button">Fix Objectives</button>
                            <button id="aspect_destinia_open_objective_report" class="menu_button" title="Open latest objective evaluation report">View Report</button>
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
                                <label class="aspect-destinia-label">Current Beat Template</label>
                                <textarea id="aspect_destinia_prompt_current"></textarea>
                            </div>
                            <div class="aspect-destinia-field">
                                <label class="aspect-destinia-label">Next Beat Template</label>
                                <textarea id="aspect_destinia_prompt_next"></textarea>
                            </div>
                        </div>

                        <div class="aspect-destinia-field">
                            <label class="aspect-destinia-label">Transition Template</label>
                            <textarea id="aspect_destinia_prompt_transition"></textarea>
                        </div>

                        <div class="aspect-destinia-grid two">
                            <div class="aspect-destinia-field">
                                <label class="aspect-destinia-label">Objective Mode Template</label>
                                <textarea id="aspect_destinia_prompt_objectives"></textarea>
                            </div>
                            <div class="aspect-destinia-field">
                                <label class="aspect-destinia-label">Hint Mode Template</label>
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
                            <label class="aspect-destinia-label">Pacing Instruction</label>
                            <textarea id="aspect_destinia_prompt_pacing"></textarea>
                        </div>

                        <div class="aspect-destinia-field">
                            <label class="aspect-destinia-label">Objective Completion Guidance</label>
                            <textarea id="aspect_destinia_prompt_objective_guidance"></textarea>
                        </div>

                        <div class="aspect-destinia-field">
                            <label class="aspect-destinia-label">Evaluator Prompt</label>
                            <textarea id="aspect_destinia_prompt_evaluator" class="aspect-destinia-code tall"></textarea>
                        </div>

                        <div class="aspect-destinia-field">
                            <label class="aspect-destinia-label">Objective Template Evaluator Prompt</label>
                            <textarea id="aspect_destinia_prompt_objective_template_evaluator" class="aspect-destinia-code tall"></textarea>
                        </div>

                        <div class="aspect-destinia-field">
                            <label class="aspect-destinia-label">Objective Template Fixer Prompt</label>
                            <textarea id="aspect_destinia_prompt_objective_template_fixer" class="aspect-destinia-code"></textarea>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div id="aspect_destinia_objective_report_modal" class="aspect-destinia-objective-report-modal" aria-hidden="true">
        <div class="aspect-destinia-objective-report-dialog">
            <div class="aspect-destinia-objective-report-header">
                <div class="aspect-destinia-section-title">Objective Evaluation Report</div>
                <button id="aspect_destinia_close_objective_report" class="menu_button" title="Close report">✕</button>
            </div>
            <div id="aspect_destinia_objective_report_body" class="aspect-destinia-objective-report-body"></div>
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

    bindDebouncedButtonAction('#aspect_destinia_validate', () => {
        const parsed = safeParseTimeline($('#aspect_destinia_timeline').val());
        if (parsed) {
            toastr.success(`${MODULE_NAME}: timeline JSON is valid.`);
        } else {
            toastr.error(`${MODULE_NAME}: invalid timeline JSON.`);
        }
    }, { showBusy: false });

    bindDebouncedButtonAction('#aspect_destinia_eval_objectives', () => evaluateTemplateObjectivesFromInput(true));
    bindDebouncedButtonAction('#aspect_destinia_fix_objectives', () => fixTemplateObjectivesFromInput());
    bindDebouncedButtonAction('#aspect_destinia_open_objective_report', () => openObjectiveEvaluationReportModal(), { showBusy: false, debounceMs: 120 });
    bindDebouncedButtonAction('#aspect_destinia_close_objective_report', () => closeObjectiveReportModal(), { showBusy: false, debounceMs: 80 });

    $('#aspect_destinia_objective_report_modal').on('click', function (event) {
        if (event.target === this) {
            closeObjectiveReportModal();
        }
    });

    $('#aspect_destinia_objective_report_body').on('click', '.aspect-destinia-icon-action', async function () {
        const reportIndex = Number($(this).data('reportIndex'));
        if (!Number.isInteger(reportIndex)) return;
        if ($(this).data('busy')) return;

        $(this).data('busy', true).prop('disabled', true);
        try {
            await withBusyIndicator(() => fixSingleObjectiveFromReportIndex(reportIndex));
        } finally {
            $(this).data('busy', false).prop('disabled', false);
        }
    });

    bindDebouncedButtonAction('#aspect_destinia_prev', () => stepBeat(-1), { showBusy: false, debounceMs: 120 });
    bindDebouncedButtonAction('#aspect_destinia_next', () => stepBeat(1), { showBusy: false, debounceMs: 120 });
    bindDebouncedButtonAction('#aspect_destinia_reset_beat', resetCurrentBeatToFirst, { showBusy: false, debounceMs: 120 });
    bindDebouncedButtonAction('#aspect_destinia_clear_chat', clearCurrentChatMessages);

    $('#aspect_destinia_strictness, #aspect_destinia_pacing, #aspect_destinia_threshold, #aspect_destinia_objective_threshold').on('input', updateSliderDisplays);

    addFieldResetButtons();
}



function renderRoot() {
    if (document.getElementById(ROOT_ID)) return;
    $('#extensions_settings').append(buildSettingsHtml());

    const modal = document.getElementById('aspect_destinia_objective_report_modal');
    if (modal && modal.parentElement !== document.body) {
        document.body.appendChild(modal);
    }

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
