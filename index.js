const MODULE_ID = 'st-aspect-destinia';
const MODULE_NAME = 'Aspect: Destinia';
const ROOT_ID = 'aspect_destinia_root';
const EXTENSION_PROMPT_KEY = 'aspect_destinia_prompt';
// Default to local evaluation to avoid backend tool-calling failures
// (e.g. "DEGRADED function cannot be invoked") surfacing to end users.
let remoteIntentEvalDisabled = true;

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
                'Establish the setting and immediate situation.',
                'Surface the main character motivations that matter for this phase.',
                'Allow the user to meaningfully interact with the current story situation.'
            ],
            completionHints: [
                'The current situation has clearly played out.',
                'The user is signaling movement toward the next development.',
                'The scene feels narratively ready to transition.'
            ],
            steeringPrompt: 'Keep the narrative focused on the opening situation while remaining flexible to the user’s choices.',
            pace: 'medium',
            delayable: true
        },
        {
            id: 'plot-point-2',
            title: 'First Escalation',
            summary: 'Describe the next major development or escalation.',
            objectives: [
                'Introduce the next complication or escalation naturally.',
                'Preserve continuity from the prior beat.',
                'Let the user influence how the transition feels.'
            ],
            completionHints: [
                'The escalation is now active in the story.',
                'Key consequences or reactions have begun.',
                'The cast is no longer grounded in the previous beat.'
            ],
            steeringPrompt: 'Transition naturally into the escalation without making the shift feel abrupt or forced.',
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
    intentWindow: 8,
    respectUserIntent: true,
    timelineText: JSON.stringify(DEFAULT_TIMELINE_TEMPLATE, null, 2),
    timeline: structuredClone(DEFAULT_TIMELINE_TEMPLATE),
    state: {
        currentIndex: 0,
        lastIntentDecision: 'stay',
        lastIntentConfidence: 0,
        lastIntentReason: 'No intent evaluation has run yet.',
        lastEvalHash: '',
        lastTransitionAt: 0
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
                'If the user is trying to linger, deepen, explore, talk, reflect, investigate, or otherwise remain within the current beat, do not hurry the story onward.',
                'If the user is clearly pushing events forward, initiating a transition, resolving the present situation, or steering into the next development, allow progression.',
                'Never railroad. Make progression feel like a natural consequence of the scene.'
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

        evaluatorPrompt:
            [
                'You are evaluating roleplay progression for a story timeline controller.',
                'Read the recent chat and determine whether the USER is signaling that the story should stay on the current beat or may transition toward the next beat.',
                'Respect lingering behavior. Wanting to talk more, investigate more, reflect more, train more, or dwell on consequences counts as staying on the current beat unless the user clearly pushes onward.',
                'Return ONLY valid JSON with these keys:',
                '{',
                '  "decision": "stay" | "advance",',
                '  "confidence": 0.0,',
                '  "reason": "short explanation",',
                '  "beat_complete": true,',
                '  "user_wants_to_linger": false',
                '}',
                '',
                'Story title: {{story_title}}',
                'Current beat: {{current_title}}',
                'Current beat summary: {{current_summary}}',
                'Current beat objectives: {{current_objectives_inline}}',
                'Current beat completion hints: {{current_hints_inline}}',
                'Next beat: {{next_title}}',
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
        return parsed;
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
        current_objectives: formatList(current.objectives),
        current_hints: formatList(current.completionHints),
        current_objectives_inline: Array.isArray(current.objectives) ? current.objectives.join('; ') : '',
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

async function evaluateIntentIfNeeded(trigger = 'unknown') {
    const ctx = getCtx();
    const profile = getActiveProfile();
    if (!profile?.enabled) return;
    if (!profile.autoAdvance && !profile.respectUserIntent) return;

    const currentBeat = getCurrentBeat(profile);
    if (!currentBeat) return;

    const hash = chatHash(profile.intentWindow || 8);
    if (hash === profile.state.lastEvalHash) return;

    profile.state.lastEvalHash = hash;

    const data = buildTemplateData(profile);
    data.recent_chat = stringifyRecentChat(profile.intentWindow || 8);

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
        const beatComplete = Boolean(parsed.beat_complete);
        const userWantsToLinger = Boolean(parsed.user_wants_to_linger);

        let finalDecision = decision;
        if (userWantsToLinger) finalDecision = 'stay';
        if (!beatComplete && finalDecision === 'advance' && profile.advancementMode === 'objectives') {
            finalDecision = 'stay';
        }

        profile.state.lastIntentDecision = finalDecision;
        profile.state.lastIntentConfidence = confidence;
        profile.state.lastIntentReason = String(parsed.reason || 'No reason provided.');

        const canAdvance =
            profile.autoAdvance &&
            finalDecision === 'advance' &&
            confidence >= Number(profile.transitionThreshold || 0.72) &&
            !!getNextBeat(profile);

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
    } catch (err) {
        console.warn(`[${MODULE_NAME}] Intent evaluation failed`, err);
        profile.state.lastIntentDecision = 'stay';
        profile.state.lastIntentReason = `Evaluation failed: ${err.message}`;
        persistProfile(profile);
        updateExtensionPrompt();
        refreshUI();
    }
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

async function evaluateIntentModelOrFallback(ctx, prompt, profile, recentChatText) {
    if (remoteIntentEvalDisabled) {
        return evaluateIntentLocally(profile, recentChatText);
    }

    try {
        const result = await ctx.generateQuietPrompt({ quietPrompt: prompt });
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
    const text = String(recentChatText || '').toLowerCase();
    const userLines = text
        .split('\n')
        .filter(line => line.toLowerCase().includes('user:'))
        .slice(-3)
        .join(' ');

    const advanceSignals = [
        'next', 'move on', 'continue', 'let\'s go', 'lets go', 'head to', 'after this',
        'done here', 'finished', 'resolve this', 'leave', 'proceed', 'advance'
    ];
    const lingerSignals = [
        'wait', 'hold on', 'stay', 'linger', 'talk more', 'investigate', 'look around',
        'reflect', 'train', 'not yet', 'before we go', 'keep exploring'
    ];

    const advanceHits = advanceSignals.filter(s => userLines.includes(s)).length;
    const lingerHits = lingerSignals.filter(s => userLines.includes(s)).length;

    let decision = 'stay';
    let confidence = 0.55;
    let reason = 'Local fallback evaluator found no strong progression signal.';

    if (advanceHits > lingerHits) {
        decision = 'advance';
        confidence = Math.min(0.9, 0.62 + (advanceHits * 0.08));
        reason = 'Local fallback evaluator detected forward-progress wording from the user.';
    } else if (lingerHits > 0) {
        decision = 'stay';
        confidence = Math.min(0.9, 0.65 + (lingerHits * 0.07));
        reason = 'Local fallback evaluator detected linger/deepen wording from the user.';
    }

    const currentBeat = getCurrentBeat(profile);
    const hints = Array.isArray(currentBeat?.completionHints) ? currentBeat.completionHints : [];
    const beatComplete = hints.length > 0
        ? hints.some(h => userLines.includes(String(h).toLowerCase().slice(0, 24))) || decision === 'advance'
        : decision === 'advance';

    return {
        decision,
        confidence,
        reason,
        beat_complete: beatComplete,
        user_wants_to_linger: lingerHits > advanceHits
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
    setSelectedProfileId(selectedId);
    return getProfileById(selectedId);
}

function profileToForm(profile) {
    if (!profile) {
        clearForm();
        return;
    }

    $('#aspect_destinia_profile_select').val(profile.id);
    $('#aspect_destinia_entry_name').val(profile.entryName || '');
    $('#aspect_destinia_enabled').prop('checked', !!profile.enabled);
    $('#aspect_destinia_mode').val(profile.advancementMode || 'objectives');
    $('#aspect_destinia_auto_advance').prop('checked', !!profile.autoAdvance);
    $('#aspect_destinia_foreshadow').prop('checked', !!profile.foreshadowNextBeat);
    $('#aspect_destinia_respect_intent').prop('checked', !!profile.respectUserIntent);
    $('#aspect_destinia_strictness').val(profile.strictness ?? 0.55);
    $('#aspect_destinia_pacing').val(profile.pacingBias ?? 0.45);
    $('#aspect_destinia_threshold').val(profile.transitionThreshold ?? 0.72);
    $('#aspect_destinia_window').val(profile.intentWindow ?? 8);
    $('#aspect_destinia_chat_select').val(profile.attachedChatKey || '');
    $('#aspect_destinia_timeline').val(profile.timelineText || JSON.stringify(DEFAULT_TIMELINE_TEMPLATE, null, 2));

    $('#aspect_destinia_prompt_intro').val(profile.prompts.injectionIntro || '');
    $('#aspect_destinia_prompt_principles').val(profile.prompts.guidancePrinciples || '');
    $('#aspect_destinia_prompt_current').val(profile.prompts.currentBeatTemplate || '');
    $('#aspect_destinia_prompt_objectives').val(profile.prompts.objectiveModeTemplate || '');
    $('#aspect_destinia_prompt_hints').val(profile.prompts.hintModeTemplate || '');
    $('#aspect_destinia_prompt_next').val(profile.prompts.nextBeatTemplate || '');
    $('#aspect_destinia_prompt_linger').val(profile.prompts.lingerInstruction || '');
    $('#aspect_destinia_prompt_advance').val(profile.prompts.advanceInstruction || '');
    $('#aspect_destinia_prompt_pacing').val(profile.prompts.pacingInstruction || '');
    $('#aspect_destinia_prompt_evaluator').val(profile.prompts.evaluatorPrompt || '');

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
    $('#aspect_destinia_window').val(8);
    $('#aspect_destinia_chat_select').val('');
    $('#aspect_destinia_timeline').val(JSON.stringify(DEFAULT_TIMELINE_TEMPLATE, null, 2));
}

function formToProfile(profile) {
    const parsedTimeline = safeParseTimeline($('#aspect_destinia_timeline').val());
    if (!parsedTimeline) {
        throw new Error('Timeline JSON must be valid and include plotPoints[].');
    }

    profile.entryName = $('#aspect_destinia_entry_name').val().trim() || 'Untitled Entry';
    profile.enabled = $('#aspect_destinia_enabled').is(':checked');
    profile.advancementMode = $('#aspect_destinia_mode').val();
    profile.autoAdvance = $('#aspect_destinia_auto_advance').is(':checked');
    profile.foreshadowNextBeat = $('#aspect_destinia_foreshadow').is(':checked');
    profile.respectUserIntent = $('#aspect_destinia_respect_intent').is(':checked');
    profile.strictness = Number($('#aspect_destinia_strictness').val() || 0.55);
    profile.pacingBias = Number($('#aspect_destinia_pacing').val() || 0.45);
    profile.transitionThreshold = Number($('#aspect_destinia_threshold').val() || 0.72);
    profile.intentWindow = Number($('#aspect_destinia_window').val() || 8);

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
    profile.prompts.lingerInstruction = $('#aspect_destinia_prompt_linger').val();
    profile.prompts.advanceInstruction = $('#aspect_destinia_prompt_advance').val();
    profile.prompts.pacingInstruction = $('#aspect_destinia_prompt_pacing').val();
    profile.prompts.evaluatorPrompt = $('#aspect_destinia_prompt_evaluator').val();

    const totalBeats = profile.timeline.plotPoints.length;
    if (profile.state.currentIndex >= totalBeats) {
        profile.state.currentIndex = Math.max(0, totalBeats - 1);
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
    const linked = getLinkedProfileIdForCurrentChat();
    const isActiveForChat = linked && profile?.id === linked;

    $('#aspect_destinia_status').html(`
        <div class="aspect-destinia-status-grid">
            <div class="aspect-destinia-stat">
                <div class="aspect-destinia-stat-label">Current Chat</div>
                <div class="aspect-destinia-stat-value">${escapeHtml(getChatLabel())}</div>
            </div>
            <div class="aspect-destinia-stat">
                <div class="aspect-destinia-stat-label">Active Entry for Chat</div>
                <div class="aspect-destinia-stat-value">${isActiveForChat ? 'Yes' : 'No'}</div>
            </div>
            <div class="aspect-destinia-stat">
                <div class="aspect-destinia-stat-label">Current Beat</div>
                <div class="aspect-destinia-stat-value">${escapeHtml(current?.title || 'None')}</div>
            </div>
            <div class="aspect-destinia-stat">
                <div class="aspect-destinia-stat-label">Next Beat</div>
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
                                <select id="aspect_destinia_profile_select"></select>
                            </div>
                            <button id="aspect_destinia_create" class="menu_button">Create Entry for Current Chat</button>
                            <button id="aspect_destinia_duplicate" class="menu_button">Duplicate Entry</button>
                            <button id="aspect_destinia_delete" class="menu_button menu_button_danger">Delete Entry</button>
                        </div>
                    </div>

                    <div class="aspect-destinia-card">
                        <div class="aspect-destinia-grid two">
                            <div class="aspect-destinia-field">
                                <label class="aspect-destinia-label">Entry Name</label>
                                <input id="aspect_destinia_entry_name" type="text" />
                            </div>
                            <div class="aspect-destinia-field">
                                <label class="aspect-destinia-label">Attached Chat</label>
                                <div class="aspect-destinia-inline">
                                    <select id="aspect_destinia_chat_select"></select>
                                    <button id="aspect_destinia_attach_current" class="menu_button">Use Current Chat</button>
                                </div>
                            </div>
                        </div>

                        <div class="aspect-destinia-grid three">
                            <label class="checkbox_label"><input id="aspect_destinia_enabled" type="checkbox" /> Enabled</label>
                            <label class="checkbox_label"><input id="aspect_destinia_auto_advance" type="checkbox" /> Auto-advance when ready</label>
                            <label class="checkbox_label"><input id="aspect_destinia_foreshadow" type="checkbox" /> Foreshadow next beat</label>
                            <label class="checkbox_label"><input id="aspect_destinia_respect_intent" type="checkbox" /> Respect user lingering intent</label>
                            <div class="aspect-destinia-field">
                                <label class="aspect-destinia-label">Advancement Mode</label>
                                <select id="aspect_destinia_mode">
                                    <option value="objectives">Objective-based rules</option>
                                    <option value="hints">Simple completion hints</option>
                                </select>
                            </div>
                            <div class="aspect-destinia-field">
                                <label class="aspect-destinia-label">Intent Window</label>
                                <input id="aspect_destinia_window" type="number" min="4" max="20" step="1" />
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
                        </div>

                        <div class="aspect-destinia-actions">
                            <button id="aspect_destinia_save" class="menu_button menu_button_primary">Save Entry</button>
                            <button id="aspect_destinia_validate" class="menu_button">Validate Timeline JSON</button>
                            <button id="aspect_destinia_eval" class="menu_button">Run Intent Check Now</button>
                            <button id="aspect_destinia_prev" class="menu_button">Previous Beat</button>
                            <button id="aspect_destinia_next" class="menu_button">Next Beat</button>
                            <button id="aspect_destinia_reset_beat" class="menu_button">Reset to First Beat</button>
                        </div>
                    </div>

                    <div class="aspect-destinia-card">
                        <div class="aspect-destinia-section-title">Status</div>
                        <div id="aspect_destinia_status"></div>
                    </div>

                    <div class="aspect-destinia-card">
                        <div class="aspect-destinia-section-title">Timeline JSON</div>
                        <textarea id="aspect_destinia_timeline" class="aspect-destinia-code"></textarea>
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
                            <label class="aspect-destinia-label">Intent Evaluator Prompt</label>
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

    $('#aspect_destinia_create').on('click', createProfileAttachedToCurrentChat);
    $('#aspect_destinia_duplicate').on('click', duplicateSelectedProfile);
    $('#aspect_destinia_delete').on('click', deleteSelectedProfile);
    $('#aspect_destinia_attach_current').on('click', attachSelectedProfileToCurrentChat);
    $('#aspect_destinia_save').on('click', saveDisplayedProfile);

    $('#aspect_destinia_validate').on('click', () => {
        const parsed = safeParseTimeline($('#aspect_destinia_timeline').val());
        if (parsed) {
            toastr.success(`${MODULE_NAME}: timeline JSON is valid.`);
        } else {
            toastr.error(`${MODULE_NAME}: invalid timeline JSON.`);
        }
    });

    $('#aspect_destinia_eval').on('click', async () => {
        await evaluateIntentIfNeeded('manual');
        refreshUI();
    });

    $('#aspect_destinia_prev').on('click', () => stepBeat(-1));
    $('#aspect_destinia_next').on('click', () => stepBeat(1));
    $('#aspect_destinia_reset_beat').on('click', resetCurrentBeatToFirst);

    $('#aspect_destinia_strictness, #aspect_destinia_pacing, #aspect_destinia_threshold').on('input', updateSliderDisplays);
}

function renderRoot() {
    if (document.getElementById(ROOT_ID)) return;
    $('#extensions_settings').append(buildSettingsHtml());
    bindUI();
    refreshUI();
}

function onChatChanged() {
    registerKnownChat();
    refreshUI();
    updateExtensionPrompt();
}

function bindEvents() {
    const ctx = getCtx();
    ctx.eventSource.on(ctx.event_types.CHAT_CHANGED, onChatChanged);
    ctx.eventSource.on(ctx.event_types.MESSAGE_SENT, async () => {
        await evaluateIntentIfNeeded('user message');
    });
    ctx.eventSource.on(ctx.event_types.MESSAGE_RECEIVED, async () => {
        await evaluateIntentIfNeeded('assistant message');
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
    console.log(`[${MODULE_NAME}] loaded`);
});
