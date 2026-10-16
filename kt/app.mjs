import {
	createLine,
	createProject,
	generateAss,
	makeId,
	parseSrt,
	validateProject,
} from './model.mjs';

/** @typedef {import('./model.mjs').KaraokeProject} KaraokeProject */
/** @typedef {import('./model.mjs').KaraokeLine} KaraokeLine */
/** @typedef {import('./model.mjs').WorkflowStatus} WorkflowStatus */

/**
 * @typedef {{active:boolean,lineId:string|null,taps:number[],originalTimings:number[],originalStatus:WorkflowStatus}}
 * TapTimingSession
 */
/**
 * @typedef {{duration:number,currentTime:number,playing:boolean,objectUrl:string|null}}
 * AudioPlaybackState
 */
/**
 * @typedef {{project:KaraokeProject,dirty:boolean,timing:TapTimingSession,audio:AudioPlaybackState,reviewLineId:string|null}}
 * EditorState
 */

/** @type {EditorState} */
const state = {
	project: createProject(),
	dirty: false,
	timing: { active: false, lineId: null, taps: [], originalTimings: [], originalStatus: 'unsplit' },
	audio: { duration: 0, currentTime: 0, playing: false, objectUrl: null },
	reviewLineId: null
};
let reviewAnimationFrame = 0;

const audio = document.querySelector('#audio');
if (!(audio instanceof HTMLAudioElement)) throw new Error('Audio player element is missing.');

/**
 * Finds a required HTML element.
 *
 * @param {string} selector CSS selector to query.
 * @returns {HTMLElement} The matching element.
 */
function el(selector) {
	const element = document.querySelector(selector);
	if (!(element instanceof HTMLElement)) throw new Error(`Element not found: ${selector}`);
	return element;
}

/**
 * Finds a required input element.
 *
 * @param {string} selector CSS selector to query.
 * @returns {HTMLInputElement} The matching input.
 */
function input(selector) {
	const element = el(selector);
	if (!(element instanceof HTMLInputElement)) throw new Error(`Input not found: ${selector}`);
	return element;
}

/**
 * Finds a required textarea element.
 *
 * @param {string} selector CSS selector to query.
 * @returns {HTMLTextAreaElement} The matching textarea.
 */
function textarea(selector) {
	const element = el(selector);
	if (!(element instanceof HTMLTextAreaElement)) throw new Error(`Textarea not found: ${selector}`);
	return element;
}

/**
 * Finds a required select element.
 *
 * @param {string} selector CSS selector to query.
 * @returns {HTMLSelectElement} The matching select.
 */
function selectElement(selector) {
	const element = el(selector);
	if (!(element instanceof HTMLSelectElement)) throw new Error(`Select not found: ${selector}`);
	return element;
}

/**
 * Finds a required button element.
 *
 * @param {string} selector CSS selector to query.
 * @returns {HTMLButtonElement} The matching button.
 */
function button(selector) {
	const element = el(selector);
	if (!(element instanceof HTMLButtonElement)) throw new Error(`Button not found: ${selector}`);
	return element;
}

/**
 * Gets the currently selected lyric line.
 *
 * @returns {KaraokeLine|null} The selected line, or `null` when none is selected.
 */
const selectedLine = () =>
	state.project.lines.find(line => line.id === state.project.selectedLineId) || null;

/**
 * Formats a numeric value with millisecond precision.
 *
 * @param {number} value Value to format.
 * @returns {string} The value with three decimal places.
 */
const fixed = value => (Number.isFinite(value) ? value : 0).toFixed(3);

/**
 * Formats a media time for the transport display.
 *
 * @param {number} seconds Time in seconds.
 * @returns {string} A `MM:SS.mmm` timestamp.
 */
function clock(seconds) {
	const s = Math.max(0, seconds || 0), m = Math.floor(s / 60);
	return `${String(m).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}.${String(Math.floor(s % 1 * 1000)).padStart(3, '0')}`;
}
/**
 * Displays a temporary status or error message.
 *
 * @param {string} message Message to display.
 * @param {boolean} [error=false] Whether to use error styling.
 * @returns {void}
 */
function notify(message, error = false) {
	const box = el('#notice');
	box.textContent = message;
	box.classList.remove('hidden', 'error');
	box.classList.toggle('error', error);
	clearTimeout(notify.timer);
	notify.timer = setTimeout(() => box.classList.add('hidden'), 6000);
}
notify.timer = 0;
/** Marks the current project as having unsaved changes. */
function changed() {
	state.dirty = true;
}

/**
 * Downloads generated text through a temporary object URL.
 *
 * @param {string} text File content.
 * @param {string} filename Suggested download filename.
 * @param {string} type MIME type for the generated file.
 * @returns {void}
 */
function download(text, filename, type) {
	const url = URL.createObjectURL(new Blob([text], { type }));
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.click();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}
/**
 * Converts a title into a filename safe for common filesystems.
 *
 * @param {string} value Raw title.
 * @returns {string} Sanitized filename stem.
 */
function safeName(value) {
	return value.trim().replace(/[<>:"/\\|?*\x00-\x1F]/g, '_') || 'karaoke';
}

/** Render all project-controlled UI. */
function render() {
	renderLineList();
	renderEditor();
	renderPreferences();
}
function renderLineList() {
	const list = el('#line-list');
	list.replaceChildren();
	state.project.lines.forEach((line, index) => {
		const li = document.createElement('li');
		li.className = `line-item${line.id === state.project.selectedLineId ? ' selected' : ''}`;
		li.tabIndex = 0;
		li.dataset.id = line.id;
		li.setAttribute('aria-current', line.id === state.project.selectedLineId ? 'true' : 'false');
		const main = document.createElement('div'), preview = document.createElement('div'),
			times = document.createElement('div'), status = document.createElement('span');
		preview.className = 'preview';
		preview.textContent = line.text || '(empty line)';
		times.className = 'times';
		times.textContent = `${index + 1}. ${fixed(line.start)} → ${fixed(line.end)}`;
		status.className = 'status';
		status.textContent = line.status;
		main.append(preview, times);
		li.append(main, status);
		li.addEventListener('click', () => selectLine(line.id));
		li.addEventListener('keydown', e => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				selectLine(line.id);
			}
		});
		list.append(li);
	});
}
function renderEditor() {
	const line = selectedLine();
	el('#no-selection').classList.toggle('hidden', Boolean(line));
	el('#line-editor').classList.toggle('hidden', !line);
	if (!line) return;

	const lineText = textarea('#line-text');
	const lineStart = input('#line-start');
	const lineEnd = input('#line-end');
	lineText.value = line.text;
	lineStart.value = fixed(line.start);
	lineEnd.value = fixed(line.end);
	el('#line-status').textContent = line.status;
	renderSplitSegments(line);
	renderTiming(line);
}
/**
 * Renders editable segment cards for a lyric line.
 *
 * @param {KaraokeLine} line Line whose segments should be displayed.
 * @returns {void}
 */
function renderSplitSegments(line) {
	const root = el('#split-segments');
	root.replaceChildren();
	line.segments.forEach((segment, index) => {
		const card = document.createElement('div');
		card.className = 'segment-card';
		const label = document.createElement('label');
		label.textContent = `Segment ${index + 1}`;
		const area = document.createElement('textarea');
		area.value = segment.text;
		area.rows = 2;
		area.dataset.segment = segment.id;
		area.addEventListener('input', () => editSegment(line, index, area.value));
		const tools = document.createElement('div');
		tools.className = 'segment-tools';
		const split = document.createElement('button');
		split.className = 'ui tiny button';
		split.textContent = 'Split at caret';
		split.addEventListener('click', () => splitSegment(line, index, area.selectionStart));
		tools.append(split);
		if (index > 0) {
			const merge = document.createElement('button');
			merge.className = 'ui tiny button';
			merge.textContent = 'Merge left';
			merge.addEventListener('click', () => mergeSegment(line, index));
			tools.append(merge);
		}
		label.append(area);
		card.append(label, tools);
		root.append(card);
	});
	el('#split-warning').textContent = line.timings.length ?
		'Changing segments preserves matching timing starts where possible and requires review.' :
		'';
}
/**
 * Applies an edit to one segment and rebuilds the complete lyric text.
 *
 * @param {KaraokeLine} line Line containing the segment.
 * @param {number} index Segment index.
 * @param {string} text New segment text.
 * @returns {void}
 */
function editSegment(line, index, text) {
	line.segments[index].text = text;
	line.text = line.segments.map(s => s.text).join('');
	invalidateTiming(line, true);
	changed();
	renderLineList();
	textarea('#line-text').value = line.text;
}
/**
 * Snaps a UTF-16 caret offset to the nearest safe grapheme boundary.
 *
 * @param {string} text Segment text.
 * @param {number} caret Requested caret offset.
 * @returns {number} A safe offset at which the segment can be split.
 */
function safeCaret(text, caret) {
	if (caret <= 0 || caret >= text.length) return caret;
	const segmenter =
		globalThis.Intl?.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
	if (!segmenter)
		return /[\uD800-\uDBFF]/.test(text[caret - 1]) && /[\uDC00-\uDFFF]/.test(text[caret]) ?
			caret + 1 :
			caret;
	const boundaries = [...segmenter.segment(text)].map(x => x.index);
	boundaries.push(text.length);
	return boundaries.reduce((best, n) => Math.abs(n - caret) < Math.abs(best - caret) ? n : best, 0);
}
/**
 * Divides one segment at the requested caret position.
 *
 * @param {KaraokeLine} line Line containing the segment.
 * @param {number} index Segment index.
 * @param {number} caret UTF-16 caret offset within the segment.
 * @returns {void}
 */
function splitSegment(line, index, caret) {
	const text = line.segments[index].text, pos = safeCaret(text, caret);
	if (pos <= 0 || pos >= text.length) {
		notify('Place the caret inside the segment before splitting.', true);
		return;
	}
	const oldTimings = [...line.timings];
	const left = { id: makeId(), text: text.slice(0, pos) };
	const right = { id: makeId(), text: text.slice(pos) };
	line.segments.splice(index, 1, left, right);
	line.timings =
		oldTimings.length ? [...oldTimings.slice(0, index + 1), ...oldTimings.slice(index + 1)] : [];
	invalidateTiming(line, false);
	changed();
	render();
	const nextArea = [...document.querySelectorAll('#split-segments textarea')]
		.find(area => area.dataset.segment === right.id);
	if (nextArea instanceof HTMLTextAreaElement) {
		nextArea.focus();
		nextArea.setSelectionRange(0, 0);
	}
}
/**
 * Merges a segment into its left-hand neighbor.
 *
 * @param {KaraokeLine} line Line containing the segment.
 * @param {number} index Index of the right-hand segment.
 * @returns {void}
 */
function mergeSegment(line, index) {
	line.segments.splice(
		index - 1, 2,
		{ id: makeId(), text: line.segments[index - 1].text + line.segments[index].text });
	if (line.timings.length) line.timings.splice(index, 1);
	invalidateTiming(line, false);
	changed();
	render();
}
/**
 * Downgrades workflow status after segment content or boundaries change.
 *
 * @param {KaraokeLine} line Modified line.
 * @param {boolean} textOnly Whether only segment text changed.
 * @returns {void}
 */
function invalidateTiming(line, textOnly) {
	if (line.status === 'confirmed' || line.status === 'timed')
		line.status = line.timings.length === line.segments.length && !textOnly ? 'timed' : 'split';
	if (line.timings.length > line.segments.length) line.timings.length = line.segments.length;
	if (state.timing.lineId === line.id) cancelTiming(false);
}

/**
 * Renders timing chips, manual timestamp fields, and timing controls.
 *
 * @param {KaraokeLine} line Line whose timing should be displayed.
 * @returns {void}
 */
function renderTiming(line) {
	const visual = el('#timing-segments'), table = el('#timing-table');
	visual.replaceChildren();
	table.replaceChildren();
	const taps =
		state.timing.active && state.timing.lineId === line.id ? state.timing.taps : line.timings;
	line.segments.forEach((segment, index) => {
		const chip = document.createElement('span');
		chip.className = `segment-card${index === taps.length && state.timing.active ? ' active' : ''}${index < taps.length ? ' done' : ''}`;
		chip.dataset.segmentIndex = String(index);
		chip.textContent = segment.text || '(empty)';
		visual.append(chip);
		const row = document.createElement('tr'), number = document.createElement('td'),
			text = document.createElement('td'), start = document.createElement('td'),
			duration = document.createElement('td'), input = document.createElement('input');
		number.textContent = String(index + 1);
		text.textContent = segment.text || '(empty)';
		input.type = 'number';
		input.min = '0';
		input.step = '0.001';
		input.value = taps[index] === undefined ? '' : fixed(taps[index]);
		input.disabled = state.timing.active;
		input.setAttribute('aria-label', `Start time for segment ${index + 1}`);
		input.addEventListener('change', () => manualTiming(line, index, input.value));
		start.append(input);
		const finish = taps[index + 1] ?? line.end;
		duration.textContent = taps[index] === undefined ? '—' : `${fixed(finish - taps[index])} s`;
		row.append(number, text, start, duration);
		table.append(row);
	});
	const canTime = line.status !== 'unsplit';
	const startButton = button('#start-timing');
	const tapButton = button('#tap');
	const undoButton = button('#undo-tap');
	const previewButton = button('#preview-timing');
	const confirmButton = button('#confirm-timing');

	startButton.disabled = !canTime;
	tapButton.disabled = !state.timing.active;
	undoButton.disabled = !state.timing.active || !state.timing.taps.length;
	previewButton.disabled = line.timings.length !== line.segments.length;
	confirmButton.disabled = line.status !== 'timed';
	if (state.reviewLineId === line.id) updateReviewHighlight();
}
/**
 * Applies a manually entered syllable start timestamp.
 *
 * @param {KaraokeLine} line Line being corrected.
 * @param {number} index Segment index.
 * @param {string} raw Raw number-input value.
 * @returns {void}
 */
function manualTiming(line, index, raw) {
	const value = Number(raw);
	if (!Number.isFinite(value) || value < 0) {
		notify('Enter a valid non-negative timestamp.', true);
		renderTiming(line);
		return;
	}
	const copy = [...line.timings];
	copy[index] = value;
	if (copy.some((n, i) => !Number.isFinite(n) || (i && n <= copy[i - 1])) ||
		copy.at(-1) > line.end) {
		notify('Syllable starts must increase and may not exceed the line end.', true);
		renderTiming(line);
		return;
	}
	line.timings = copy;
	if (copy.length === line.segments.length)
		line.status = 'timed';
	else
		line.status = 'split';
	changed();
	render();
}

/**
 * Selects a lyric line and displays its editor.
 *
 * @param {string} id Stable line ID.
 * @returns {void}
 */
function selectLine(id) {
	if (state.timing.active) cancelTiming(false);
	stopReview();
	state.project.selectedLineId = id;
	render();
	el('#line-editor').scrollIntoView({ block: 'nearest' });
}
function startTiming() {
	const line = selectedLine();
	if (!line || line.status === 'unsplit') {
		notify('Confirm syllable splitting first.', true);
		return;
	}
	stopReview();
	state.timing = {
		active: true,
		lineId: line.id,
		taps: [],
		originalTimings: [...line.timings],
		originalStatus: line.status
	};
	audio.currentTime = Math.max(0, line.start - state.project.preferences.leadIn);
	audio.play().catch(
		() => notify('Playback could not start. Select a supported audio file first.', true));
	renderTiming(line);
}
function recordTap() {
	const line = selectedLine();
	if (!line || !state.timing.active || state.timing.lineId !== line.id) return;
	if (state.timing.taps.length >= line.segments.length) {
		notify('All syllable starts are already recorded.');
		return;
	}
	const time = audio.currentTime, last = state.timing.taps.at(-1);
	if ((last !== undefined && time <= last) || time > line.end) {
		notify('Tap must be after the previous tap and no later than the line end.', true);
		return;
	}
	state.timing.taps.push(time);
	if (state.timing.taps.length === line.segments.length) {
		line.timings = [...state.timing.taps];
		line.status = 'timed';
		state.timing.active = false;
		audio.pause();
		changed();
		notify('Timing recorded. Review the starts, then confirm the line.');
		render();
	} else
		renderTiming(line);
}
function undoTap() {
	const line = selectedLine();
	if (!line || !state.timing.active) return;
	state.timing.taps.pop();
	renderTiming(line);
}

/** Play the selected timed line while highlighting its current syllable. */
function previewTiming() {
	const line = selectedLine();
	if (!line || line.timings.length !== line.segments.length) {
		notify('Complete the line timing before previewing it.', true);
		return;
	}
	if (!audio.src) {
		notify('Choose an audio file before previewing timing.', true);
		return;
	}
	if (state.timing.active) cancelTiming();
	state.reviewLineId = line.id;
	audio.currentTime = line.start;
	el('#preview-timing').textContent = 'Stop preview';
	updateReviewHighlight();
	audio.play().catch(() => {
		stopReview();
		notify('Playback could not start.', true);
	});
	runReviewAnimation();
}

/** Remove review state and all syllable highlights. */
function stopReview() {
	state.reviewLineId = null;
	cancelAnimationFrame(reviewAnimationFrame);
	document.querySelectorAll('#timing-segments .segment-card').forEach(card => {
		card.classList.remove('review-current', 'review-past');
	});
	const button = document.querySelector('#preview-timing');
	if (button) button.textContent = 'Preview';
}

/** Update preview at display-frame frequency so short syllables are not skipped. */
function runReviewAnimation() {
	cancelAnimationFrame(reviewAnimationFrame);
	const step = () => {
		const line = state.project.lines.find(item => item.id === state.reviewLineId);
		if (!line) return;
		updateReviewHighlight();
		if (audio.currentTime >= line.end) {
			audio.pause();
			state.reviewLineId = null;
			el('#preview-timing').textContent = 'Preview';
			return;
		}
		reviewAnimationFrame = requestAnimationFrame(step);
	};
	reviewAnimationFrame = requestAnimationFrame(step);
}

/** Synchronize the review highlight with the media timeline. */
function updateReviewHighlight() {
	const line = state.project.lines.find(item => item.id === state.reviewLineId);
	if (!line || line.id !== state.project.selectedLineId) return;
	let current = -1;
	for (let index = 0; index < line.timings.length; index++) {
		if (audio.currentTime >= line.timings[index]) current = index;
	}
	document.querySelectorAll('#timing-segments .segment-card').forEach(card => {
		const index = Number(card.dataset.segmentIndex);
		card.classList.toggle('review-current', index === current);
		card.classList.toggle('review-past', index < current);
	});
}
/**
 * Cancels the active timing take.
 *
 * @param {boolean} [restore=true] Whether to restore timing from before the take.
 * @returns {void}
 */
function cancelTiming(restore = true) {
	const line = state.project.lines.find(x => x.id === state.timing.lineId);
	if (line && restore) {
		line.timings = [...state.timing.originalTimings];
		line.status = state.timing.originalStatus;
	}
	state.timing.active = false;
	state.timing.lineId = null;
	audio.pause();
	if (line) render();
}

/**
 * Applies lyric text from the line editor.
 *
 * @param {Event} event Textarea change event.
 * @returns {void}
 */
function updateLineText(event) {
	const line = selectedLine();
	if (!line) return;
	if (!(event.target instanceof HTMLTextAreaElement)) return;
	const text = event.target.value;
	if (line.timings.length &&
		!confirm('Changing lyric text will reset splitting and timing. Continue?')) {
		renderEditor();
		return;
	}
	line.text = text;
	line.segments = [{ id: makeId(), text }];
	line.timings = [];
	line.status = 'unsplit';
	changed();
	render();
}
/**
 * Validates and applies a line start or end timestamp.
 *
 * @param {'start'|'end'} field Timestamp field to update.
 * @param {string} raw Raw number-input value.
 * @returns {void}
 */
function updateLineTime(field, raw) {
	const line = selectedLine(), value = Number(raw);
	if (!line || !Number.isFinite(value) || value < 0 || (field === 'start' && value >= line.end) ||
		(field === 'end' && value <= line.start)) {
		notify('Line times must be non-negative and end must be after start.', true);
		renderEditor();
		return;
	}
	line[field] = value;
	if (field === 'end' && line.timings.at(-1) > value) {
		line.status = 'split';
		line.timings = [];
		notify('Timing was cleared because the new end precedes a syllable start.');
	} else if (line.status === 'confirmed')
		line.status = 'timed';
	changed();
	render();
}

/**
 * Loads a local audio file into the media element.
 *
 * @param {File} file User-selected audio file.
 * @returns {void}
 */
function loadAudio(file) {
	if (state.audio.objectUrl) URL.revokeObjectURL(state.audio.objectUrl);
	const url = URL.createObjectURL(file);
	state.audio.objectUrl = url;
	audio.src = url;
	state.project.audio.filename = file.name;
	el('#audio-name').textContent = file.name;
	changed();
	audio.load();
}
/**
 * Imports subtitle cues from a local SRT file.
 *
 * @param {File} file User-selected SRT file.
 * @returns {Promise<void>}
 */
async function importSrt(file) {
	try {
		const imported = parseSrt(await file.text());
		if (state.project.lines.length &&
			!confirm(`Append ${imported.length} imported cues to the existing lyrics?`))
			return;
		state.project.lines.push(...imported);
		state.project.selectedLineId = imported[0].id;
		changed();
		render();
		notify(`Imported ${imported.length} cue${imported.length === 1 ? '' : 's'}.`);
	} catch (error) {
		notify(error instanceof Error ? error.message : 'Could not import SRT.', true);
	}
}
/**
 * Validates and opens a saved karaoke project.
 *
 * @param {File} file User-selected JSON project file.
 * @returns {Promise<void>}
 */
async function openProject(file) {
	try {
		const loaded = validateProject(JSON.parse(await file.text()));
		if (state.dirty && !confirm('Replace the current project and discard unsaved changes?')) return;
		state.project = loaded;
		state.dirty = false;
		audio.pause();
		audio.removeAttribute('src');
		audio.load();
		if (state.audio.objectUrl) URL.revokeObjectURL(state.audio.objectUrl);
		state.audio.objectUrl = null;
		el('#audio-name').textContent = loaded.audio.filename ?
			`Select audio again: ${loaded.audio.filename}` :
			'No audio selected';
		render();
		notify('Project opened. Choose the corresponding audio file to resume playback.');
	} catch (error) {
		notify(error instanceof Error ? error.message : 'Invalid project file.', true);
	}
}

/** Wire static controls. */
function bind() {
	el('#add-line').addEventListener('click', () => {
		const line = createLine({ start: audio.currentTime, end: audio.currentTime + 5 });
		state.project.lines.push(line);
		state.project.selectedLineId = line.id;
		changed();
		render();
	});
	el('#duplicate-line').addEventListener('click', () => {
		const line = selectedLine();
		if (!line) return;
		const copy = createLine({
			text: line.text,
			start: line.start,
			end: line.end,
			segments: line.segments.map(s => ({ id: makeId(), text: s.text })),
			timings: [...line.timings],
			status: line.status
		});
		const i = state.project.lines.indexOf(line);
		state.project.lines.splice(i + 1, 0, copy);
		state.project.selectedLineId = copy.id;
		changed();
		render();
	});
	el('#delete-line').addEventListener('click', () => {
		const line = selectedLine();
		if (!line || !confirm('Delete this lyric line?')) return;
		const i = state.project.lines.indexOf(line);
		state.project.lines.splice(i, 1);
		state.project.selectedLineId =
			state.project.lines[Math.min(i, state.project.lines.length - 1)]?.id || null;
		changed();
		render();
	});
	for (const [selector, delta] of [['#move-up', -1], ['#move-down', 1]])
		el(selector).addEventListener('click', () => {
			const line = selectedLine();
			if (!line) return;
			const i = state.project.lines.indexOf(line), j = i + delta;
			if (j < 0 || j >= state.project.lines.length) return;
			[state.project.lines[i], state.project.lines[j]] =
				[state.project.lines[j], state.project.lines[i]];
			changed();
			renderLineList();
		});
	el('#line-text').addEventListener('change', updateLineText);
	el('#line-start').addEventListener('change', e => updateLineTime('start', e.target.value));
	el('#line-end').addEventListener('change', e => updateLineTime('end', e.target.value));
	el('#set-start')
		.addEventListener('click', () => updateLineTime('start', String(audio.currentTime)));
	el('#set-end').addEventListener('click', () => updateLineTime('end', String(audio.currentTime)));
	el('#jump-line').addEventListener('click', () => {
		const line = selectedLine();
		if (line) audio.currentTime = Math.max(0, line.start - state.project.preferences.leadIn);
	});
	el('#confirm-split').addEventListener('click', () => {
		const line = selectedLine();
		if (!line || !line.segments.length) return;
		if (line.segments.map(s => s.text).join('') !== line.text) {
			notify('Segment text must concatenate to the lyric text.', true);
			return;
		}
		line.status =
			line.timings.length === line.segments.length && line.timings.length ? 'timed' : 'split';
		changed();
		render();
	});
	el('#start-timing').addEventListener('click', startTiming);
	el('#tap').addEventListener('click', recordTap);
	el('#undo-tap').addEventListener('click', undoTap);
	el('#cancel-timing').addEventListener('click', () => cancelTiming());
	el('#preview-timing').addEventListener('click', () => {
		if (state.reviewLineId) {
			audio.pause();
			stopReview();
		} else {
			previewTiming();
		}
	});
	el('#confirm-timing').addEventListener('click', () => {
		const line = selectedLine();
		if (line?.status === 'timed') {
			line.status = 'confirmed';
			changed();
			render();
			notify('Line confirmed.');
		}
	});
	el('#audio-file').addEventListener('change', e => {
		const file = e.target.files?.[0];
		if (file) loadAudio(file);
		e.target.value = '';
	});
	el('#srt-file').addEventListener('change', e => {
		const file = e.target.files?.[0];
		if (file) importSrt(file);
		e.target.value = '';
	});
	el('#project-file').addEventListener('change', e => {
		const file = e.target.files?.[0];
		if (file) openProject(file);
		e.target.value = '';
	});
	el('#save-project').addEventListener('click', () => {
		download(
			JSON.stringify(state.project, null, 2), `${safeName(state.project.title)}.karaoke.json`,
			'application/json;charset=utf-8');
		state.dirty = false;
		notify('Project saved.');
	});
	el('#export-ass').addEventListener('click', () => {
		const policy = state.project.preferences.incompletePolicy;
		const count =
			state.project.lines.filter(l => l.status === 'confirmed' || policy === 'plain').length;
		if (!count) {
			notify('There are no lines eligible for the selected export policy.', true);
			return;
		}
		download(
			'\uFEFF' + generateAss(state.project, policy), `${safeName(state.project.title)}.ass`,
			'text/plain;charset=utf-8');
		notify(`Exported ${count} line${count === 1 ? '' : 's'}.`);
	});
	for (const id of ['title', 'artist'])
		el(`#${id}`).addEventListener('input', e => {
			state.project[id] = e.target.value;
			changed();
		});
	el('#offset').addEventListener('change', e => {
		state.project.globalOffset = Number(e.target.value) || 0;
		changed();
	});
	el('#lead-in').addEventListener('change', e => {
		state.project.preferences.leadIn = Math.max(0, Number(e.target.value) || 0);
		changed();
	});
	el('#loop-line').addEventListener('change', e => {
		state.project.preferences.loopLine = e.target.checked;
		changed();
	});
	el('#incomplete-policy').addEventListener('change', e => {
		state.project.preferences.incompletePolicy = e.target.value;
		changed();
	});
	el('#play').addEventListener('click', togglePlay);
	el('#seek').addEventListener('input', e => {
		audio.currentTime = Number(e.target.value);
	});
	el('#speed').addEventListener('change', e => {
		audio.playbackRate = Number(e.target.value);
		state.project.preferences.playbackRate = audio.playbackRate;
		changed();
	});
	el('#volume').addEventListener('input', e => {
		audio.volume = Number(e.target.value);
		state.project.preferences.volume = audio.volume;
		changed();
	});
	audio.addEventListener('loadedmetadata', () => {
		state.audio.duration = audio.duration;
		el('#seek').max = String(audio.duration);
		updateClock();
	});
	audio.addEventListener(
		'error', () => notify('The browser could not load or decode this audio file.', true));
	audio.addEventListener('play', () => {
		state.audio.playing = true;
		el('#play').textContent = 'Pause';
		if (state.reviewLineId) runReviewAnimation();
	});
	audio.addEventListener('pause', () => {
		state.audio.playing = false;
		el('#play').textContent = 'Play';
	});
	audio.addEventListener('ended', () => {
		if (state.timing.active)
			notify(
				'Audio ended before all syllables were timed. Seek back and continue, or retry.', true);
	});
	audio.addEventListener('timeupdate', () => {
		state.audio.currentTime = audio.currentTime;
		updateClock();
		if (state.reviewLineId) {
			updateReviewHighlight();
			return;
		}
		const line = selectedLine();
		if (line && state.project.preferences.loopLine && audio.currentTime >= line.end) {
			audio.currentTime = Math.max(0, line.start - state.project.preferences.leadIn);
			audio.play();
		}
	});
	document.addEventListener('keydown', e => {
		if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement ||
			e.target instanceof HTMLSelectElement || e.target?.isContentEditable)
			return;
		if (e.code === 'Space') {
			e.preventDefault();
			if (state.reviewLineId) stopReview();
			togglePlay();
		} else if (e.key.toLowerCase() === 'f') {
			e.preventDefault();
			recordTap();
		} else if (e.key === 'Backspace') {
			e.preventDefault();
			undoTap();
		} else if (e.key === 'Escape' && state.timing.active) {
			e.preventDefault();
			cancelTiming();
		}
	});
	window.addEventListener('beforeunload', e => {
		if (state.dirty) {
			e.preventDefault();
			e.returnValue = '';
		}
	});
	window.addEventListener('unload', () => {
		if (state.audio.objectUrl) URL.revokeObjectURL(state.audio.objectUrl);
	});
}

function togglePlay() {
	if (!audio.src) {
		notify('Choose an audio file first.', true);
		return;
	}
	if (audio.paused)
		audio.play().catch(() => notify('Playback could not start.', true));
	else
		audio.pause();
}

function updateClock() {
	input('#seek').value = String(audio.currentTime || 0);
	el('#clock').textContent = `${clock(audio.currentTime)} / ${clock(audio.duration)}`;
}

/** Renders project preferences into their form controls. */
function renderPreferences() {
	input('#title').value = state.project.title;
	input('#artist').value = state.project.artist;
	input('#offset').value = String(state.project.globalOffset);
	input('#lead-in').value = String(state.project.preferences.leadIn);
	input('#loop-line').checked = state.project.preferences.loopLine;
	selectElement('#speed').value = String(state.project.preferences.playbackRate);
	input('#volume').value = String(state.project.preferences.volume);
	selectElement('#incomplete-policy').value = state.project.preferences.incompletePolicy;
	audio.playbackRate = state.project.preferences.playbackRate;
	audio.volume = state.project.preferences.volume;
}

bind();
render();
