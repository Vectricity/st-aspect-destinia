import { debounce } from '../../../utils.js';
import { getContext, extension_settings, saveSettingsDebounced } from '../../../extensions.js';
import { generateQuietPrompt } from '../../../../script.js';

const MODULE_NAME = 'st-aspect-destinia';
const MODULE_NAME_FANCY = 'Aspect: Destinia';
const SETTINGS_HTML_FILE = 'settings.html';
const PROMPT_KEY = `${MODULE_NAME}_prompt`;

const defaultTimelineTemplate = {
    storyTitle: 'Untitled Story',
    systemStyle: 'Stay coherent with the source premise, preserve continuity, and move with natural scene pacing while remaining responsive to the user.',
    plotPoints: [
        {
            id: 'opening_turn',
            title: 'Opening Turn',
            summary: 'Establish the opening situation, central tension, and immediate direction of the scene.',
            steeringPrompt: 'Emphasize setup, first impressions, stakes, and momentum into the opening scenario.',
            completionHints: [
                'The opening situation has been clearly established',
                'The major participants are grounded in the scene',
                'The immediate conflict or direction is visible'
            ],
            objectives: [
                'Establish the setting and present situation',
                'Clarify what the protagonist wants or must respond to',
                'Create a clear direction into the next beat'
            ],
            pace: 'medium',
            delayable: true
        },
        {
            id: 'first_complication',
            title: 'First Complication',
            summary: 'Introduce the first significant complication that redirects the situation or raises the stakes.',
            steeringPrompt: 'Escalate the situation through consequences, uncertainty, pressure, or a revealing new obstacle.',
            completionHints: [
                'A clear complication has changed the situation',
                'The stakes or difficulty have increased',
                'The cast is reacting to the new pressure'
            ],
            objectives: [
                'Introduce a meaningful complication',
                'Force a response or adaptation from the cast',
                'Make the next movement of the story feel earned'
            ],
            pace: 'medium',
            delayable: true
        }
    ]
};

const defaultEntry = {
    id: '',
    name: 'New Entry',
    boundChatKey: '',
    boundChatLabel: '',
    enabled: true,
    autoEvaluate: true,
    autoAdvance: true,
    hold: false,
    showNextBeat: true,
    advancementMode: 'hints',
    completionThreshold: 0.78,
    currentIndex: 0,
    storyTitle: defaultTimelineTemplate.storyTitle,
    storyStyle: defaultTimelineTemplate.systemStyle,
    timelineText: JSON.stringify(defaultTimelineTemplate, null, 2),
    timeline: structuredClone(defaultTimelineTemplate),
    instructionPreamble: 'Guide the narrative softly along the configured story timeline.',
    instructionStoryStyle: 'Apply the configured story style without becoming rigid or mechanical.',
    instructionCurrentBeat: 'Keep the current beat as the narrative center of gravity until it has been substantially fulfilled.',
    instructionHintsMode: 'Use the completion hints as soft signs of readiness rather than as a rigid checklist.',
    instructionObjectivesMode: 'Use the beat objectives as stronger progression gates and try to satisfy them through natural scene flow.',
    instructionUserAdvance: 'If the user’s roleplay clearly pushes toward movement, consequence, escalation, travel, discovery, or resolution, treat that as intent to progress.',
    instructionUserDelay: 'If the user’s roleplay clearly lingers, explores, socializes, investigates, reflects, or otherwise stays with the present situation, treat that as intent to remain on the current beat.',
    instructionTransition: 'When progression becomes appropriate, transition smoothly and causally rather than abruptly jumping ahead.',
    instructionNextBeat: 'Foreshadow the next beat lightly through scene pressure, consequence, setup, or anticipation, but do not force it early.',
    instructionHold: 'Progression is on hold. Stay with the current beat even if some completion conditions are present.',
    instructionDoNotExpose: 'Do not reveal timeline metadata, beat names, objectives, or internal guidance directly to the user.',
    evaluatorInstruction:
`You are evaluating whether a roleplay scene has progressed far enough to move to the next planned story beat.
Return ONLY valid JSON with these keys:
{
  "beatComplete": boolean,
  "userWantsAdvance": boolean,
  "userWantsDelay": boolean,
  "confidence": number,
  "reason": string
}

Rules:
- Respect user roleplay intent. Do not mark progression as appropriate if the user is clearly choosing to linger on the current beat.
- "userWantsAdvance" should be true only when the user's direction clearly pushes events forward.
- "userWantsDelay" should be true when the user's direction clearly indicates they want to remain, explore, converse, investigate, reflect, or otherwise not move on yet.
- "beatComplete" should be based on the configured hints or objectives plus what actually happened in the recent chat.
- Confidence must be between 0 and 1.`,
    lastEvaluation: 'Not evaluated yet.',
    lastCheckHash: ''
};

const defaultSettings = {
    entries: {},
    activeEntryId: '',
    debugMode: false
};

let ui = {
    ready: false,
    draftEntry: null,
    dirty: false
};

function log(...args) {
    console.log(`[${MODULE_NAME_FANCY}]`, ...args);
}

function warnToast(message) {
    toastr.warning(message, MODULE_NAME_FANCY);
}

function infoToast(message) {
    toastr.info(message, MODULE_NAME_FANCY);
}

function successToast(message) {
    toastr.success(message, MODULE_NAME_FANCY);
}

function errorToast(message) {
    toastr.error(message, MODULE_NAME_FANCY);
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, m => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[m]));
}

function getExtensionDirectory() {
    const indexPath = new URL(import.meta.url).pathname;
    return indexPath.substring(0, indexPath.lastIndexOf('/'));
}

async function loadSettingsHtml() {
    const moduleDir = getExtensionDirectory();
    const path = `${moduleDir}/${SETTINGS_HTML_FILE}`;
    await $.get(path).then((response) => {
        $('#extensions_settings2').append(response);
    }).catch((response) => {
        throw new Error(`Failed to load settings.html (${response?.status ?? 'unknown status'})`);
    });
}

function ensureSettings() {
    if (!extension_settings[MODULE_NAME]) {
        extension_settings[MODULE_NAME] = structuredClone(defaultSettings);
    }

    extension_settings[MODULE_NAME] = Object.assign(
        structuredClone(defaultSettings),
        extension_settings[MODULE_NAME]
    );

    const settings = extension_settings[MODULE_NAME];

    if (!settings.entries || typeof settings.entries !== 'object') {
        settings.entries = {};
    }

    if (!settings.activeEntryId || !settings.entries[settings.activeEntryId]) {
        const firstEntryId = Object.keys(settings.entries)[0];
        if (firstEntryId) {
            settings.activeEntryId = firstEntryId;
        }
    }

    return settings;
}

function getSettings() {
    return ensureSettings();
}

function getEntries() {
    return getSettings().entries;
}

function getEntry(entryId = null) {
    const settings = getSettings();
    const id = entryId ?? settings.activeEntryId;
    return id ? settings.entries[id] ?? null : null;
}

function setDirty(value) {
    ui.dirty = Boolean(value);
    const label = $('#aspect_destinia_dirty_label');
    if (!label.length) return;

    if (ui.dirty) {
        label.text('Unsaved changes').removeClass('aspect-destinia-saved').addClass('aspect-destinia-dirty');
    } else {
        label.text('Saved').removeClass('aspect-destinia-dirty').addClass('aspect-destinia-saved');
    }
}

function newId() {
    return `destinia_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeTimelineObject(parsed) {
    const timeline = Object.assign({}, defaultTimelineTemplate, parsed || {});
    if (!Array.isArray(timeline.plotPoints)) {
        timeline.plotPoints = structuredClone(defaultTimelineTemplate.plotPoints);
    }

    timeline.plotPoints = timeline.plotPoints.map((point, index) => ({
        id: point.id || `beat_${index + 1}`,
        title: point.title || `Beat ${index + 1}`,
        summary: point.summary || '',
        steeringPrompt: point.steeringPrompt || '',
        completionHints: Array.isArray(point.completionHints) ? point.completionHints : [],
        objectives: Array.isArray(point.objectives) ? point.objectives : [],
        pace: point.pace || 'medium',
        delayable: point.delayable !== false
    }));

    return timeline;
}

function buildEntryFromDefaults() {
    const entry = structuredClone(defaultEntry);
    entry.id = newId();
    return entry;
}

function getCurrentChatKey() {
    const ctx = getContext();
    const parts = [];

    if (ctx.groupId) {
        parts.push(`group:${ctx.groupId}`);
    } else if (ctx.characterId !== undefined && ctx.characterId !== null) {
        parts.push(`char:${ctx.characterId}`);
    } else {
        parts.push('chat:unknown-scope');
    }

    if (ctx.chatId) {
        parts.push(`chatid:${ctx.chatId}`);
    } else if (ctx.chat?.length !== undefined) {
        parts.push(`len:${ctx.chat.length}`);
    }

    return parts.join('|');
}

function getCurrentChatLabel() {
    const ctx = getContext();
    const who = ctx.groupId ? (ctx.name2 || 'Group Chat') : (ctx.name2 || 'Chat');
    const suffix = ctx.chatId ? ` (${ctx.chatId})` : '';
    return `${who}${suffix}`;
}

function collectDetectedChats() {
    const map = new Map();

    const currentKey = getCurrentChatKey();
    const currentLabel = getCurrentChatLabel();
    map.set(currentKey, currentLabel);

    for (const entry of Object.values(getEntries())) {
        if (entry.boundChatKey) {
            map.set(entry.boundChatKey, entry.boundChatLabel || entry.boundChatKey);
        }
    }

    const selectors = [
        '[data-chat-id]',
        '[chatid]',
        '#SelectChatPopup [data-id]',
        '#select_chat_popup [data-id]',
        '.select_chat_block[chatid]',
        '.select_chat_block[data-chat-id]'
    ];

    for (const selector of selectors) {
        document.querySelectorAll(selector).forEach((el) => {
            const id = el.getAttribute('data-chat-id') || el.getAttribute('chatid') || el.getAttribute('data-id');
            if (!id) return;

            const text = (el.textContent || '').trim().replace(/\s+/g, ' ');
            const label = text || `Chat ${id}`;
            if (!map.has(id)) {
                map.set(id, label);
            }
        });
    }

    return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
}

function refreshEntryDropdown() {
    const $select = $('#aspect_destinia_entry_select');
    if (!$select.length) return;

    const settings = getSettings();
    $select.empty();

    const entries = Object.values(getEntries());
    if (!entries.length) {
        $select.append('<option value="">No entries</option>');
    } else {
        for (const entry of entries) {
            const selected = entry.id === settings.activeEntryId ? 'selected' : '';
            $select.append(`<option value="${escapeHtml(entry.id)}" ${selected}>${escapeHtml(entry.name)}</option>`);
        }
    }
}

function refreshChatDropdown() {
    const $select = $('#aspect_destinia_chat_select');
    if (!$select.length) return;

    const selectedValue = $select.val();
    const chats = collectDetectedChats();

    $select.empty();
    for (const chat of chats) {
        $select.append(`<option value="${escapeHtml(chat.id)}">${escapeHtml(chat.label)}</option>`);
    }

    if (selectedValue && chats.some(x => x.id === selectedValue)) {
        $select.val(selectedValue);
    } else if (chats.length) {
        $select.val(chats[0].id);
    }
}

function autoSelectEntryForCurrentChat() {
    const settings = getSettings();
    const currentChatKey = getCurrentChatKey();

    const match = Object.values(getEntries()).find(entry => entry.boundChatKey === currentChatKey);
    if (match) {
        settings.activeEntryId = match.id;
    }
}

function loadDraftFromActiveEntry() {
    const entry = getEntry();
    ui.draftEntry = entry ? structuredClone(entry) : null;
    setDirty(false);
    renderFormFromDraft();
    updateStatusCards();
    updatePrompt();
}

function renderFormFromDraft() {
    const d = ui.draftEntry;
    if (!ui.ready) return;

    refreshEntryDropdown();
    refreshChatDropdown();

    if (!d) {
        $('#aspect_destinia_active_chip').text('No active entry');
        return;
    }

    $('#aspect_destinia_active_chip').text(`Active: ${d.name}`);
    $('#aspect_destinia_entry_name').val(d.name);
    $('#aspect_destinia_enabled').prop('checked', d.enabled);
    $('#aspect_destinia_auto_evaluate').prop('checked', d.autoEvaluate);
    $('#aspect_destinia_auto_advance').prop('checked', d.autoAdvance);
    $('#aspect_destinia_hold').prop('checked', d.hold);
    $('#aspect_destinia_show_next').prop('checked', d.showNextBeat);
    $('#aspect_destinia_advancement_mode').val(d.advancementMode);
    $('#aspect_destinia_completion_threshold').val(d.completionThreshold);

    $('#aspect_destinia_story_title').val(d.storyTitle);
    $('#aspect_destinia_story_style').val(d.storyStyle);
    $('#aspect_destinia_timeline_text').val(d.timelineText);

    $('#aspect_destinia_instruction_preamble').val(d.instructionPreamble);
    $('#aspect_destinia_instruction_story_style').val(d.instructionStoryStyle);
    $('#aspect_destinia_instruction_current_beat').val(d.instructionCurrentBeat);
    $('#aspect_destinia_instruction_hints_mode').val(d.instructionHintsMode);
    $('#aspect_destinia_instruction_objectives_mode').val(d.instructionObjectivesMode);
    $('#aspect_destinia_instruction_user_advance').val(d.instructionUserAdvance);
    $('#aspect_destinia_instruction_user_delay').val(d.instructionUserDelay);
    $('#aspect_destinia_instruction_transition').val(d.instructionTransition);
    $('#aspect_destinia_instruction_next_beat').val(d.instructionNextBeat);
    $('#aspect_destinia_instruction_hold').val(d.instructionHold);
    $('#aspect_destinia_instruction_do_not_expose').val(d.instructionDoNotExpose);
    $('#aspect_destinia_evaluator_instruction').val(d.evaluatorInstruction);

    $('#aspect_destinia_bound_chat_label').text(d.boundChatLabel || '—');
}

function updateStatusCards() {
    const d = ui.draftEntry;
    if (!d) {
        $('#aspect_destinia_current_beat_label').text('—');
        $('#aspect_destinia_last_eval_label').text('—');
        $('#aspect_destinia_bound_chat_label').text('—');
        return;
    }

    const point = getCurrentPoint(d);
    $('#aspect_destinia_current_beat_label').text(point ? `${d.currentIndex + 1}. ${point.title}` : 'No beat');
    $('#aspect_destinia_last_eval_label').text(d.lastEvaluation || 'Not evaluated yet.');
    $('#aspect_destinia_bound_chat_label').text(d.boundChatLabel || '—');
}

function updateDraftField(key, value) {
    if (!ui.draftEntry) return;
    ui.draftEntry[key] = value;
    setDirty(true);
    updateStatusCards();
}

function getCurrentPoint(entry = null) {
    const d = entry || ui.draftEntry || getEntry();
    if (!d?.timeline?.plotPoints?.length) return null;
    const index = Math.max(0, Math.min(d.currentIndex || 0, d.timeline.plotPoints.length - 1));
    return d.timeline.plotPoints[index] || null;
}

function getNextPoint(entry = null) {
    const d = entry || ui.draftEntry || getEntry();
    if (!d?.timeline?.plotPoints?.length) return null;
    return d.timeline.plotPoints[(d.currentIndex || 0) + 1] || null;
}

function saveDraftToActiveEntry() {
    const settings = getSettings();
    const active = getEntry();

    if (!ui.draftEntry || !active) {
        warnToast('No active entry to save.');
        return;
    }

    try {
        const parsed = JSON.parse(ui.draftEntry.timelineText);
        ui.draftEntry.timeline = normalizeTimelineObject(parsed);
        ui.draftEntry.storyTitle = ui.draftEntry.storyTitle || ui.draftEntry.timeline.storyTitle || 'Untitled Story';
        if (!ui.draftEntry.storyStyle?.trim()) {
            ui.draftEntry.storyStyle = ui.draftEntry.timeline.systemStyle || '';
        }

        const maxIndex = Math.max(0, ui.draftEntry.timeline.plotPoints.length - 1);
        ui.draftEntry.currentIndex = Math.min(Math.max(0, Number(ui.draftEntry.currentIndex) || 0), maxIndex);

        settings.entries[active.id] = structuredClone(ui.draftEntry);
        saveSettingsDebounced();
        setDirty(false);
        renderFormFromDraft();
        updateStatusCards();
        updatePrompt();
        successToast('Entry saved.');
    } catch (error) {
        errorToast(`Invalid timeline JSON: ${error.message}`);
    }
}

async function createEntryForCurrentChat() {
    const ctx = getContext();
    const name = await ctx.Popup.show.input('New Destinia Entry', 'Entry name:', 'New Entry');
    if (!name) return;

    const entry = buildEntryFromDefaults();
    entry.name = name.trim() || 'New Entry';
    entry.boundChatKey = getCurrentChatKey();
    entry.boundChatLabel = getCurrentChatLabel();

    const settings = getSettings();
    settings.entries[entry.id] = entry;
    settings.activeEntryId = entry.id;
    saveSettingsDebounced();

    ui.draftEntry = structuredClone(entry);
    refreshEntryDropdown();
    renderFormFromDraft();
    updateStatusCards();
    updatePrompt();
    successToast('Entry created and bound to the active chat.');
}

async function duplicateActiveEntry() {
    const source = getEntry();
    if (!source) {
        warnToast('No active entry to duplicate.');
        return;
    }

    const copy = structuredClone(source);
    copy.id = newId();
    copy.name = `${source.name} Copy`;

    const settings = getSettings();
    settings.entries[copy.id] = copy;
    settings.activeEntryId = copy.id;
    saveSettingsDebounced();

    ui.draftEntry = structuredClone(copy);
    refreshEntryDropdown();
    renderFormFromDraft();
    updateStatusCards();
    updatePrompt();
    successToast('Entry duplicated.');
}

async function deleteActiveEntry() {
    const active = getEntry();
    if (!active) {
        warnToast('No active entry to delete.');
        return;
    }

    const ok = await getContext().Popup.show.confirm(
        `Delete entry "${active.name}"?`,
        'This cannot be undone.',
        { okButton: 'Delete', cancelButton: 'Cancel' }
    );

    if (!ok) return;

    const settings = getSettings();
    delete settings.entries[active.id];

    const remaining = Object.keys(settings.entries);
    settings.activeEntryId = remaining[0] || '';
    saveSettingsDebounced();

    loadDraftFromActiveEntry();
    refreshEntryDropdown();
    updateStatusCards();
    updatePrompt();
    successToast('Entry deleted.');
}

function bindActiveEntryToSelectedChat() {
    if (!ui.draftEntry) {
        warnToast('No active entry selected.');
        return;
    }

    const selectedKey = $('#aspect_destinia_chat_select').val();
    const chats = collectDetectedChats();
    const chat = chats.find(x => x.id === selectedKey);

    if (!chat) {
        warnToast('No chat selected.');
        return;
    }

    ui.draftEntry.boundChatKey = chat.id;
    ui.draftEntry.boundChatLabel = chat.label;
    setDirty(true);
    renderFormFromDraft();
    updateStatusCards();
}

function bindActiveEntryToCurrentChat() {
    if (!ui.draftEntry) {
        warnToast('No active entry selected.');
        return;
    }

    ui.draftEntry.boundChatKey = getCurrentChatKey();
    ui.draftEntry.boundChatLabel = getCurrentChatLabel();
    setDirty(true);
    renderFormFromDraft();
    updateStatusCards();
}

function buildGuidancePrompt(entry) {
    if (!entry?.enabled) return '';

    const point = getCurrentPoint(entry);
    if (!point) return '';

    const nextPoint = getNextPoint(entry);

    const lines = [
        `[${MODULE_NAME_FANCY}]`,
        entry.instructionPreamble,
        `Story title: ${entry.storyTitle || entry.timeline?.storyTitle || 'Untitled Story'}`,
        `${entry.instructionStoryStyle}`,
        `Story style details: ${entry.storyStyle || entry.timeline?.systemStyle || ''}`,
        `${entry.instructionCurrentBeat}`,
        `Current beat: ${point.title}`,
        `Current beat summary: ${point.summary || ''}`,
        `Current beat steering: ${point.steeringPrompt || ''}`
    ];

    if (entry.advancementMode === 'objectives') {
        lines.push(entry.instructionObjectivesMode);
        lines.push(`Current beat objectives: ${(point.objectives || []).join('; ') || 'None provided.'}`);
    } else {
        lines.push(entry.instructionHintsMode);
        lines.push(`Current beat completion hints: ${(point.completionHints || []).join('; ') || 'None provided.'}`);
    }

    lines.push(entry.instructionUserAdvance);
    lines.push(entry.instructionUserDelay);

    if (entry.hold) {
        lines.push(entry.instructionHold);
    } else {
        lines.push(entry.instructionTransition);
    }

    if (entry.showNextBeat && nextPoint) {
        lines.push(entry.instructionNextBeat);
        lines.push(`Next beat to foreshadow lightly: ${nextPoint.title} — ${nextPoint.summary || ''}`);
    }

    lines.push(entry.instructionDoNotExpose);

    return lines.filter(Boolean).join('\n');
}

function updatePrompt() {
    const ctx = getContext();
    const active = getEntry();

    if (!ctx?.setExtensionPrompt) return;

    if (!active || active.boundChatKey !== getCurrentChatKey() || !active.enabled) {
        ctx.setExtensionPrompt(PROMPT_KEY, '');
        return;
    }

    const prompt = buildGuidancePrompt(active);
    ctx.setExtensionPrompt(PROMPT_KEY, prompt, 2, 0, false, 0);
}

function hashRecentMessages() {
    const ctx = getContext();
    const content = (ctx.chat || []).slice(-10).map(m => `${m.name || (m.is_user ? 'User' : 'Assistant')}:${m.mes || ''}`).join('\n');

    let hash = 0;
    for (let i = 0; i < content.length; i++) {
        hash = (Math.imul(31, hash) + content.charCodeAt(i)) | 0;
    }
    return String(hash);
}

function safeJsonParse(text) {
    try {
        return JSON.parse(text);
    } catch {
        const match = String(text || '').match(/\{[\s\S]*\}/);
        if (!match) return null;
        try {
            return JSON.parse(match[0]);
        } catch {
            return null;
        }
    }
}

async function maybeEvaluateProgress() {
    const active = getEntry();
    const ctx = getContext();

    if (!active) return;
    if (active.boundChatKey !== getCurrentChatKey()) return;
    if (!active.enabled || !active.autoEvaluate || active.hold) return;

    const point = getCurrentPoint(active);
    if (!point) return;

    const recentHash = hashRecentMessages();
    if (recentHash === active.lastCheckHash) return;

    active.lastCheckHash = recentHash;

    const recentChat = (ctx.chat || []).slice(-10).map((m, i) => {
        const who = m.is_user ? 'User' : (m.name || 'Assistant');
        return `${i + 1}. ${who}: ${m.mes || ''}`;
    }).join('\n');

    const criteriaText = active.advancementMode === 'objectives'
        ? `Current beat objectives: ${(point.objectives || []).join('; ') || 'None provided.'}`
        : `Current beat completion hints: ${(point.completionHints || []).join('; ') || 'None provided.'}`;

    const prompt = [
        active.evaluatorInstruction,
        `Advancement rule mode: ${active.advancementMode}`,
        `Story title: ${active.storyTitle || ''}`,
        `Current beat title: ${point.title}`,
        `Current beat summary: ${point.summary || ''}`,
        `Current beat steering: ${point.steeringPrompt || ''}`,
        criteriaText,
        `Recent chat:\n${recentChat}`
    ].join('\n\n');

    try {
        const raw = await generateQuietPrompt(prompt, false, false);
        const parsed = safeJsonParse(raw);

        if (!parsed) {
            active.lastEvaluation = 'Evaluator returned non-JSON; ignored.';
            saveSettingsDebounced();
            if (ui.draftEntry && ui.draftEntry.id === active.id) {
                ui.draftEntry.lastEvaluation = active.lastEvaluation;
                updateStatusCards();
            }
            return;
        }

        const beatComplete = Boolean(parsed.beatComplete);
        const userWantsAdvance = Boolean(parsed.userWantsAdvance);
        const userWantsDelay = Boolean(parsed.userWantsDelay);
        const confidence = Number(parsed.confidence) || 0;
        const reason = String(parsed.reason || 'No reason given.');

        active.lastEvaluation =
            `${beatComplete ? 'Complete' : 'Incomplete'} | ` +
            `advance:${userWantsAdvance ? 'yes' : 'no'} | ` +
            `delay:${userWantsDelay ? 'yes' : 'no'} | ` +
            `conf:${confidence.toFixed(2)} | ${reason}`;

        const threshold = Number(active.completionThreshold) || 0.78;
        const shouldAdvance =
            active.autoAdvance &&
            beatComplete &&
            confidence >= threshold &&
            !userWantsDelay &&
            (userWantsAdvance || !point.delayable);

        if (shouldAdvance) {
            const maxIndex = active.timeline.plotPoints.length - 1;
            if (active.currentIndex < maxIndex) {
                active.currentIndex += 1;
                active.lastEvaluation = `Advanced to beat ${active.currentIndex + 1}. ${reason}`;
                successToast(`Advanced to: ${getCurrentPoint(active)?.title || 'Next beat'}`);
            }
        }

        saveSettingsDebounced();

        if (ui.draftEntry && ui.draftEntry.id === active.id && !ui.dirty) {
            ui.draftEntry = structuredClone(active);
            renderFormFromDraft();
            updateStatusCards();
        }

        updatePrompt();
    } catch (error) {
        active.lastEvaluation = `Evaluation failed: ${error.message}`;
        saveSettingsDebounced();

        if (ui.draftEntry && ui.draftEntry.id === active.id && !ui.dirty) {
            ui.draftEntry.lastEvaluation = active.lastEvaluation;
            updateStatusCards();
        }
    }
}

function bindInput(selector, key, transform = (v) => v) {
    $(selector).on('change input', function () {
        updateDraftField(key, transform($(this).val()));
    });
}

function bindCheckbox(selector, key) {
    $(selector).on('change', function () {
        updateDraftField(key, Boolean($(this).prop('checked')));
    });
}

function initializeUiBindings() {
    $('#aspect_destinia_entry_select').on('change', function () {
        const settings = getSettings();
        settings.activeEntryId = $(this).val();
        saveSettingsDebounced();
        loadDraftFromActiveEntry();
    });

    $('#aspect_destinia_new_entry').on('click', createEntryForCurrentChat);
    $('#aspect_destinia_duplicate_entry').on('click', duplicateActiveEntry);
    $('#aspect_destinia_delete_entry').on('click', deleteActiveEntry);
    $('#aspect_destinia_save_entry').on('click', saveDraftToActiveEntry);
    $('#aspect_destinia_bind_selected_chat').on('click', bindActiveEntryToSelectedChat);
    $('#aspect_destinia_bind_current_chat').on('click', bindActiveEntryToCurrentChat);

    bindInput('#aspect_destinia_entry_name', 'name', v => String(v || '').trimStart());
    bindCheckbox('#aspect_destinia_enabled', 'enabled');
    bindCheckbox('#aspect_destinia_auto_evaluate', 'autoEvaluate');
    bindCheckbox('#aspect_destinia_auto_advance', 'autoAdvance');
    bindCheckbox('#aspect_destinia_hold', 'hold');
    bindCheckbox('#aspect_destinia_show_next', 'showNextBeat');
    bindInput('#aspect_destinia_advancement_mode', 'advancementMode', v => String(v));
    bindInput('#aspect_destinia_completion_threshold', 'completionThreshold', v => Number(v));

    bindInput('#aspect_destinia_story_title', 'storyTitle', v => String(v));
    bindInput('#aspect_destinia_story_style', 'storyStyle', v => String(v));
    bindInput('#aspect_destinia_timeline_text', 'timelineText', v => String(v));

    bindInput('#aspect_destinia_instruction_preamble', 'instructionPreamble', v => String(v));
    bindInput('#aspect_destinia_instruction_story_style', 'instructionStoryStyle', v => String(v));
    bindInput('#aspect_destinia_instruction_current_beat', 'instructionCurrentBeat', v => String(v));
    bindInput('#aspect_destinia_instruction_hints_mode', 'instructionHintsMode', v => String(v));
    bindInput('#aspect_destinia_instruction_objectives_mode', 'instructionObjectivesMode', v => String(v));
    bindInput('#aspect_destinia_instruction_user_advance', 'instructionUserAdvance', v => String(v));
    bindInput('#aspect_destinia_instruction_user_delay', 'instructionUserDelay', v => String(v));
    bindInput('#aspect_destinia_instruction_transition', 'instructionTransition', v => String(v));
    bindInput('#aspect_destinia_instruction_next_beat', 'instructionNextBeat', v => String(v));
    bindInput('#aspect_destinia_instruction_hold', 'instructionHold', v => String(v));
    bindInput('#aspect_destinia_instruction_do_not_expose', 'instructionDoNotExpose', v => String(v));
    bindInput('#aspect_destinia_evaluator_instruction', 'evaluatorInstruction', v => String(v));
}

const refreshChatDropdownDebounced = debounce(() => {
    refreshChatDropdown();
}, 250);

function initializeEvents() {
    const ctx = getContext();
    const eventSource = ctx.eventSource;
    const eventTypes = ctx.event_types;

    eventSource.on(eventTypes.CHAT_CHANGED, () => {
        autoSelectEntryForCurrentChat();
        refreshEntryDropdown();
        loadDraftFromActiveEntry();
        refreshChatDropdownDebounced();
    });

    eventSource.on(eventTypes.CHARACTER_MESSAGE_RENDERED, async () => {
        updatePrompt();
        await maybeEvaluateProgress();
    });

    eventSource.on(eventTypes.MESSAGE_EDITED, async () => {
        updatePrompt();
        await maybeEvaluateProgress();
    });

    eventSource.on(eventTypes.MESSAGE_SWIPED, async () => {
        updatePrompt();
        await maybeEvaluateProgress();
    });

    eventSource.on(eventTypes.USER_MESSAGE_RENDERED, () => {
        updatePrompt();
    });
}

jQuery(async () => {
    log('Loading...');
    ensureSettings();
    await loadSettingsHtml();

    if (!Object.keys(getEntries()).length) {
        const initial = buildEntryFromDefaults();
        initial.name = 'Default Entry';
        initial.boundChatKey = getCurrentChatKey();
        initial.boundChatLabel = getCurrentChatLabel();
        getSettings().entries[initial.id] = initial;
        getSettings().activeEntryId = initial.id;
        saveSettingsDebounced();
    }

    autoSelectEntryForCurrentChat();
    initializeUiBindings();
    ui.ready = true;
    loadDraftFromActiveEntry();
    initializeEvents();
    updatePrompt();
    refreshChatDropdown();
    log('Ready.');
});
