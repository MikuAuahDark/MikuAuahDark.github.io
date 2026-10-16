/** @typedef {'unsplit'|'split'|'timed'|'confirmed'} WorkflowStatus */
/** @typedef {{id:string,text:string}} SyllableSegment */
/**
 * @typedef {{id:string,text:string,start:number,end:number,segments:SyllableSegment[],timings:number[],status:WorkflowStatus}}
 * KaraokeLine
 */
/**
 * @typedef {{leadIn:number,playbackRate:number,volume:number,loopLine:boolean,incompletePolicy:'confirmed'|'plain'}}
 * EditorPreferences
 */
/**
 * @typedef {{format:'karaoke-timing-project',version:1,title:string,artist:string,audio:{filename:string},globalOffset:number,lines:KaraokeLine[],preferences:EditorPreferences,selectedLineId:string|null}}
 * KaraokeProject
 */

/**
 * Creates a unique identifier for a project entity.
 *
 * @returns {string} A UUID when available, otherwise a locally generated ID.
 */
export function makeId() {
	return globalThis.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Creates a lyric line using defaults for any omitted properties.
 *
 * @param {Partial<KaraokeLine>} [source] Initial line properties.
 * @returns {KaraokeLine} The new lyric line.
 */
export function createLine(source = {}) {
	const text = typeof source.text === 'string' ? source.text : '';
	return {
		id: source.id || makeId(),
		text,
		start: Number.isFinite(source.start) ? source.start : 0,
		end: Number.isFinite(source.end) ? source.end : 5,
		segments: source.segments || [{ id: makeId(), text }],
		timings: source.timings || [],
		status: source.status || 'unsplit'
	};
}

/**
 * Creates an empty version 1 karaoke project.
 *
 * @returns {KaraokeProject} The new project.
 */
export function createProject() {
	return {
		format: 'karaoke-timing-project',
		version: 1,
		title: '',
		artist: '',
		audio: { filename: '' },
		globalOffset: 0,
		lines: [],
		preferences:
			{ leadIn: 2, playbackRate: 1, volume: 1, loopLine: false, incompletePolicy: 'confirmed' },
		selectedLineId: null
	};
}

/**
 * Checks whether a value can be inspected as a string-keyed object.
 *
 * @param {unknown} value Value to inspect.
 * @returns {value is Record<string, any>} Whether the value is a non-null object.
 */
function isRecord(value) {
	return value !== null && typeof value === 'object';
}

/**
 * Validates and normalizes data loaded from a project file.
 *
 * @param {unknown} value Parsed JSON data.
 * @returns {KaraokeProject} A validated project safe to place in editor state.
 * @throws {Error} If the data is malformed or uses an unsupported version.
 */
export function validateProject(value) {
	if (!isRecord(value)) throw new Error('Project must be a JSON object.');
	const p = value;
	if (p.format !== 'karaoke-timing-project')
		throw new Error('This is not a karaoke timing project.');
	if (p.version !== 1) throw new Error(`Unsupported project version: ${String(p.version)}.`);
	if (!Array.isArray(p.lines)) throw new Error('Project lines are missing.');
	const ids = new Set();
	const lines = p.lines.map((raw, index) => {
		if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || ids.has(raw.id))
			throw new Error(`Line ${index + 1} has an invalid or duplicate ID.`);
		ids.add(raw.id);
		if (typeof raw.text !== 'string' || !Number.isFinite(raw.start) || !Number.isFinite(raw.end) ||
			raw.start < 0 || raw.end <= raw.start)
			throw new Error(`Line ${index + 1} has invalid text or timestamps.`);
		if (!Array.isArray(raw.segments) ||
			raw.segments.some(s => !s || typeof s.id !== 'string' || typeof s.text !== 'string'))
			throw new Error(`Line ${index + 1} has invalid segments.`);
		if (!Array.isArray(raw.timings) ||
			raw.timings.some((t, i, a) => !Number.isFinite(t) || t < 0 || (i && t <= a[i - 1])))
			throw new Error(`Line ${index + 1} has invalid timing boundaries.`);
		if (!['unsplit', 'split', 'timed', 'confirmed'].includes(raw.status))
			throw new Error(`Line ${index + 1} has an invalid status.`);
		if ((raw.status === 'timed' || raw.status === 'confirmed') &&
			(raw.timings.length !== raw.segments.length || raw.timings.at(-1) > raw.end))
			throw new Error(`Line ${index + 1} has incomplete or out-of-range timing.`);
		return createLine({
			id: raw.id,
			text: raw.text,
			start: raw.start,
			end: raw.end,
			segments: raw.segments.map(s => ({ id: s.id, text: s.text })),
			timings: [...raw.timings],
			status: raw.status
		});
	});
	const prefs = p.preferences || {};
	return {
		format: p.format,
		version: 1,
		title: typeof p.title === 'string' ? p.title : '',
		artist: typeof p.artist === 'string' ? p.artist : '',
		audio: { filename: typeof p.audio?.filename === 'string' ? p.audio.filename : '' },
		globalOffset: Number.isFinite(p.globalOffset) ? p.globalOffset : 0,
		lines,
		preferences: {
			leadIn: Number.isFinite(prefs.leadIn) ? prefs.leadIn : 2,
			playbackRate: [.5, .75, 1].includes(prefs.playbackRate) ? prefs.playbackRate : 1,
			volume: Number.isFinite(prefs.volume) ? Math.max(0, Math.min(1, prefs.volume)) : 1,
			loopLine: Boolean(prefs.loopLine),
			incompletePolicy: prefs.incompletePolicy === 'plain' ? 'plain' : 'confirmed'
		},
		selectedLineId: typeof p.selectedLineId === 'string' && ids.has(p.selectedLineId) ?
			p.selectedLineId :
			(lines[0]?.id || null)
	};
}

/**
 * Parses SRT content into editable lyric lines.
 *
 * @param {string} source Raw SRT file content.
 * @returns {KaraokeLine[]} Valid, non-empty subtitle cues.
 * @throws {Error} If no usable cues can be found.
 */
export function parseSrt(source) {
	const normalized = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
	if (!normalized) throw new Error('The SRT file is empty.');
	const blocks = normalized.split(/\n{2,}/);
	const lines = [];
	const stamp =
		/^(\d{1,2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[,.](\d{3})/;
	for (const block of blocks) {
		const rows = block.split('\n');
		let timingIndex = rows.findIndex(row => stamp.test(row.trim()));
		if (timingIndex < 0) continue;
		const match = rows[timingIndex].trim().match(stamp);
		if (!match) continue;
		const seconds = (h, m, s, ms) =>
			Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(ms) / 1000;
		const start = seconds(match[1], match[2], match[3], match[4]);
		const end = seconds(match[5], match[6], match[7], match[8]);
		const text = rows.slice(timingIndex + 1).join('\n');
		if (!text.length || end < start) continue;
		lines.push(createLine({ text, start, end }));
	}
	if (!lines.length) throw new Error('No valid, non-empty SRT cues were found.');
	return lines;
}

/**
 * Formats seconds as an ASS timestamp.
 *
 * @param {number} seconds Time in seconds.
 * @returns {string} An `H:MM:SS.CC` timestamp.
 */
function assTime(seconds) {
	const cs = Math.max(0, Math.round(seconds * 100));
	const h = Math.floor(cs / 360000), m = Math.floor(cs / 6000) % 60, s = Math.floor(cs / 100) % 60,
		c = cs % 100;
	return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(c).padStart(2, '0')}`;
}
/**
 * Escapes lyric text for use in an ASS dialogue field.
 *
 * @param {string} text Unescaped lyric text.
 * @returns {string} ASS-safe text.
 */
function escapeAss(text) {
	return text.replace(/\\/g, '\\\\')
		.replace(/{/g, '\\{')
		.replace(/}/g, '\\}')
		.replace(/\r?\n/g, '\\N');
}

/**
 * Builds the karaoke-tagged text for one confirmed line.
 *
 * @param {KaraokeLine} line The confirmed lyric line.
 * @param {number} offset Global timing offset in seconds.
 * @returns {string} Text containing ASS `\\k` duration tags.
 */
function karaokeText(line, offset) {
	const start = Math.max(0, Math.round((line.start + offset) * 100));
	const end = Math.max(start, Math.round((line.end + offset) * 100));
	const starts =
		line.timings.map(t => Math.max(start, Math.min(end, Math.round((t + offset) * 100))));
	const durations = [];
	if (starts[0] > start) durations.push({ d: starts[0] - start, text: '' });
	for (let i = 0; i < starts.length; i++)
		durations.push({
			d: (i + 1 < starts.length ? starts[i + 1] : end) - starts[i],
			text: line.segments[i].text
		});
	return durations.map(x => `{\\k${Math.max(0, x.d)}}${escapeAss(x.text)}`).join('');
}

/**
 * Serializes a project as an Advanced SubStation Alpha subtitle file.
 *
 * @param {KaraokeProject} project Project to export.
 * @param {'confirmed'|'plain'} policy How incomplete lines should be handled.
 * @returns {string} Complete ASS file content.
 */
export function generateAss(project, policy) {
	const offset = project.globalOffset / 1000;
	const events = [];
	for (const line of project.lines) {
		if (line.status !== 'confirmed' && policy === 'confirmed') continue;
		const start = Math.max(0, line.start + offset), end = Math.max(start, line.end + offset);
		const text = line.status === 'confirmed' ? karaokeText(line, offset) : escapeAss(line.text);
		events.push(`Dialogue: 0,${assTime(start)},${assTime(end)},Default,,0,0,0,,${text}`);
	}
	return `[Script Info]\n; Generated by Karaoke Timing Editor\nTitle: ${project.title.replace(
		/[\r\n]/g,
		' ')}\nScriptType: v4.00+\nWrapStyle: 0\nScaledBorderAndShadow: yes\nYCbCr Matrix: TV.601\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,Arial,48,&H00FFFFFF,&H0000FFFF,&H00000000,&H64000000,0,0,0,0,100,100,0,0,1,2,0,2,20,20,20,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n${events.join('\n')}\n`;
}
