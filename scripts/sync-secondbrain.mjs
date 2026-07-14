import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Graph from 'graphology';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import matter from 'gray-matter';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const secondBrain = path.resolve(process.env.SECOND_BRAIN_PATH || path.join(root, '..', '..', '..', 'SecondBrain'));
const wikiRoot = path.join(secondBrain, 'wiki');
const graphOutput = path.join(root, 'public', 'data', 'mind-map');
const noteOutput = path.join(graphOutput, 'notes');
const workOutput = path.join(root, 'src', 'data', 'work.json');

const excludedDirectories = new Set(['sources', 'clusters']);
const excludedFiles = new Set(['log.md']);

const colors = {
    entities: '#9b7890',
    concepts: '#587aa2',
    projects: '#a9784f',
    summaries: '#658b63',
    synthesis: '#9b8528',
    queries: '#6c3b82',
    canvases: '#4d8980',
    dashboards: '#686d78',
    wiki: '#777d86',
};

const clusterLayout = {
    summaries: { x: 0, y: 0, radius: 105 },
    entities: { x: -205, y: -5, radius: 62 },
    concepts: { x: 200, y: -5, radius: 56 },
    projects: { x: 0, y: -165, radius: 28 },
    queries: { x: -112, y: 148, radius: 28 },
    synthesis: { x: 112, y: 148, radius: 24 },
    other: { x: 0, y: 198, radius: 26 },
};

const workOverrides = {
    phib: {
        description: 'A memecoin project explored through tokenomics, transaction mechanics, branding, and launch planning.',
        year: '2022', group: 'ideas', link: null,
    },
    'austin-treasure-map': {
        description: 'A gamified map of 90+ hand-picked Austin places built for finding a new local adventure.',
        year: '2026', group: 'built', link: 'https://yg4president.github.io/austin-treasure-map/',
    },
    brotein: {
        description: 'An iOS nutrition app for scanning menus and evaluating meals for their muscle-building potential.',
        year: '2025', group: 'built', link: null,
    },
    'insight-ai': {
        description: 'A productized AI-visibility audit and lead funnel that became part of the thinking behind Rankett.',
        year: '2025', group: 'built', link: null,
    },
    'irl-lore': {
        description: 'An AI-assisted journaling concept that turns daily entries into personal lore and monthly retrospectives.',
        year: '2025', group: 'ideas', link: null,
    },
    outpace: {
        description: 'An Apple Health step-tracking app with a daily iMessage-style leaderboard for friend groups.',
        year: '2025', group: 'built', link: 'https://github.com/YG4PRESIDENT/official-outpace-website',
    },
    'baby-tracking-app': {
        description: 'A privacy-first baby tracking app designed around local storage, encryption, and opt-in cloud backup.',
        year: '2024', group: 'built', link: null,
    },
    rankett: {
        description: 'A white-label AI search optimization platform built for marketing and SEO agencies.',
        year: '2026', group: 'now', link: 'https://rankett.com',
    },
    'snap-map-app': {
        description: 'An early location-based social app concept inspired by the interaction model of Snap Map.',
        year: '2019', group: 'ideas', link: null,
    },
    swipr: {
        description: 'A swipe-based prediction product built around short sessions and accuracy-based outcomes.',
        year: '2026', group: 'built', link: null,
    },
    'te-amo': {
        description: 'A Mexican-American tea and art house concept centered on drinks, food, local art, and community.',
        year: '2023', group: 'ideas', link: null,
    },
    'vrtl-bet': {
        description: 'A friend-focused betting and prediction product concept under the VRTL Pirates umbrella.',
        year: '2025', group: 'ideas', link: null,
    },
    wagerwrld: {
        description: 'A sports-betting-with-friends app concept that preceded the later Swipr work.',
        year: '2024', group: 'ideas', link: null,
    },
    'youtube-tool': {
        description: 'A hosted Rankett microservice for turning YouTube content into AI-visibility work.',
        year: '2026', group: 'built', link: null,
    },
};

const additionalWork = [
    {
        id: 'orph', title: 'Orph',
        description: 'An iMessage-first fitness app for conversational workout, nutrition, and supplement logging.',
        year: '2026', group: 'now', link: null,
    },
    {
        id: 'betio', title: 'Betio',
        description: 'An iOS-first simulated sports prediction experience with a native app, API, and operator console.',
        year: '2026', group: 'now', link: null,
    },
    {
        id: 'lift-atx', title: 'Lift ATX',
        description: 'A custom member website and local sponsorship system for the Lift ATX gym community.',
        year: '2026', group: 'now', link: 'https://github.com/YG4PRESIDENT/liftatx',
    },
    {
        id: 'bigboigig', title: 'BigBoiGig',
        description: 'A complete technical, content, local SEO, and growth operating system for a home-comfort company.',
        year: '2026', group: 'built', link: null,
    },
    {
        id: 'mlb-kalshi-luck-bot', title: 'MLB Kalshi Luck Bot',
        description: 'A live-game MLB paper-trading research harness with a luck-adjusted win-probability model.',
        year: '2026', group: 'built', link: null,
    },
    {
        id: 'sante-designs', title: 'Sante Designs',
        description: 'A custom fashion and graphic-design brand website built with motion-led interactions.',
        year: '2026', group: 'built', link: 'https://github.com/YG4PRESIDENT/santedesigns.com',
    },
];

marked.setOptions({ gfm: true, breaks: true });

async function walk(directory) {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const files = [];
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
        const absolute = path.join(directory, entry.name);
        if (entry.isDirectory()) files.push(...await walk(absolute));
        else files.push(absolute);
    }
    return files;
}

function normalizeId(file) {
    return path.relative(wikiRoot, file).split(path.sep).join('/').replace(/\.md$/i, '');
}

function typeFor(id, data) {
    const folder = id.includes('/') ? id.split('/')[0] : '';
    const declared = String(data.type || '').toLowerCase();
    if (colors[folder]) return folder;
    if (declared && colors[`${declared}s`]) return `${declared}s`;
    return declared || 'wiki';
}

function titleFor(id, data, body) {
    if (data.title) return String(data.title).trim();
    const heading = body.match(/^#\s+(.+)$/m)?.[1];
    if (heading) return heading.trim();
    return path.posix.basename(id).replace(/[-_]+/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}

function normalizeTarget(raw) {
    return raw
        .split('|')[0]
        .split('#')[0]
        .trim()
        .replace(/\\/g, '/')
        .replace(/\.md$/i, '')
        .replace(/^\.\//, '');
}

function hashName(value) {
    return createHash('sha1').update(value).digest('hex').slice(0, 18);
}

function hashNumber(value) {
    const digest = createHash('sha1').update(value).digest();
    return digest.readUInt32BE(0) / 0xffffffff;
}

function excerptFromMarkdown(body) {
    const paragraphs = body
        .replace(/!\[\[[^\]]+\]\]/g, '')
        .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
        .replace(/\[\[([^\]]+)\]\]/g, '$1')
        .split(/\n\s*\n/)
        .map(paragraph => paragraph
            .replace(/^#{1,6}\s+/gm, '')
            .replace(/^>\s*/gm, '')
            .replace(/[*_`~]/g, '')
            .replace(/\[(.*?)\]\([^)]*\)/g, '$1')
            .replace(/\s+/g, ' ')
            .trim())
        .filter(paragraph => paragraph.length > 24 && !/^stub\b/i.test(paragraph));
    const excerpt = paragraphs[0] || 'A project from the SecondBrain archive.';
    return excerpt.length > 190 ? `${excerpt.slice(0, 187).trim()}…` : excerpt;
}

function renderMarkdown(body, resolveTarget) {
    const withWikiLinks = body
        .replace(/!\[\[([^\]]+)\]\]/g, (_match, target) => {
            const label = normalizeTarget(target).split('/').pop()?.replace(/[-_]+/g, ' ') || 'Attachment';
            return `*${label}*`;
        })
        .replace(/\[\[([^\]]+)\]\]/g, (_match, value) => {
            const [rawTarget, alias] = value.split('|');
            const target = normalizeTarget(rawTarget);
            const label = (alias || target.split('/').pop() || target).replace(/[-_]+/g, ' ');
            const resolved = resolveTarget(target);
            if (!resolved) return label;
            return `<a href="#" class="mind-link" data-node-id="${resolved}">${label}</a>`;
        });

    const html = marked.parse(withWikiLinks);
    return sanitizeHtml(html, {
        allowedTags: [
            'p', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'em', 'del',
            'blockquote', 'ul', 'ol', 'li', 'code', 'pre', 'a', 'table', 'thead', 'tbody',
            'tr', 'th', 'td'
        ],
        allowedAttributes: {
            a: ['href', 'target', 'rel', 'class', 'data-node-id'],
            code: ['class'],
        },
        allowedSchemes: ['http', 'https', 'mailto'],
    });
}

const markdownFiles = (await walk(wikiRoot)).filter(file => {
    if (!file.endsWith('.md')) return false;
    const relative = path.relative(wikiRoot, file).split(path.sep);
    if (excludedFiles.has(relative.at(-1))) return false;
    if (relative.some(segment => excludedDirectories.has(segment))) return false;
    return true;
});

const records = [];
for (const file of markdownFiles) {
    const source = await fs.readFile(file, 'utf8');
    let parsed;
    try {
        parsed = matter(source);
    } catch {
        parsed = { data: {}, content: source.replace(/^---[\s\S]*?---\s*/, '') };
    }

    const id = normalizeId(file);
    records.push({
        id,
        file,
        basename: path.posix.basename(id),
        title: titleFor(id, parsed.data, parsed.content),
        type: typeFor(id, parsed.data),
        data: parsed.data,
        body: parsed.content.trim(),
    });
}

const byId = new Map(records.map(record => [record.id.toLowerCase(), record]));
const byBasename = new Map();
for (const record of records) {
    const key = record.basename.toLowerCase();
    if (!byBasename.has(key)) byBasename.set(key, []);
    byBasename.get(key).push(record);
}

function resolveRecord(target) {
    const normalized = normalizeTarget(target).replace(/^wiki\//i, '').replace(/^\.\.\/wiki\//i, '');
    if (!normalized || normalized.startsWith('../raw/') || normalized.startsWith('raw/')) return null;
    const exact = byId.get(normalized.toLowerCase());
    if (exact) return exact;
    const candidates = byBasename.get(path.posix.basename(normalized).toLowerCase());
    return candidates?.[0] || null;
}

const nodes = new Map(records.map(record => [record.id, {
    id: record.id,
    label: record.title,
    type: record.type,
    color: colors[record.type] || colors.wiki,
    resolved: true,
    detailPath: `/data/mind-map/notes/${hashName(record.id)}.json`,
} ]));

const edgeKeys = new Set();
const edges = [];
for (const record of records) {
    for (const match of record.body.matchAll(/(?<!!)\[\[([^\]]+)\]\]/g)) {
        const targetText = normalizeTarget(match[1]);
        if (!targetText || targetText.startsWith('../raw/') || targetText.startsWith('raw/')) continue;

        const resolved = resolveRecord(targetText);
        if (!resolved) continue;
        const targetId = resolved.id;

        if (targetId === record.id) continue;
        const key = [record.id, targetId].sort().join('\u0000');
        if (edgeKeys.has(key)) continue;
        edgeKeys.add(key);
        edges.push({ source: record.id, target: targetId });
    }
}

const degree = new Map();
for (const edge of edges) {
    degree.set(edge.source, (degree.get(edge.source) || 0) + 1);
    degree.set(edge.target, (degree.get(edge.target) || 0) + 1);
}

for (const id of [...nodes.keys()]) {
    if (!degree.has(id)) nodes.delete(id);
}

const filteredEdges = edges.filter(edge => nodes.has(edge.source) && nodes.has(edge.target));
const graph = new Graph({ type: 'undirected', multi: false, allowSelfLoops: false });

for (const node of nodes.values()) {
    const angle = hashNumber(node.id) * Math.PI * 2;
    const radius = 20 + hashNumber(`${node.id}:radius`) * 80;
    graph.addNode(node.id, {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
    });
}

for (const edge of filteredEdges) {
    if (!graph.hasEdge(edge.source, edge.target)) graph.addEdge(edge.source, edge.target);
}

if (graph.order > 1 && graph.size > 0) {
    const inferred = forceAtlas2.inferSettings(graph);
    forceAtlas2.assign(graph, {
        iterations: 260,
        settings: {
            ...inferred,
            gravity: 0.22,
            scalingRatio: 7,
            slowDown: 8,
            barnesHutOptimize: graph.order > 500,
            barnesHutTheta: 0.55,
        },
    });
}

function clusterFor(type) {
    return Object.hasOwn(clusterLayout, type) ? type : 'other';
}

const clusterBounds = new Map();
for (const node of nodes.values()) {
    const cluster = clusterFor(node.type);
    const { x, y } = graph.getNodeAttributes(node.id);
    const bounds = clusterBounds.get(cluster) || {
        minX: x, maxX: x, minY: y, maxY: y,
    };
    bounds.minX = Math.min(bounds.minX, x);
    bounds.maxX = Math.max(bounds.maxX, x);
    bounds.minY = Math.min(bounds.minY, y);
    bounds.maxY = Math.max(bounds.maxY, y);
    clusterBounds.set(cluster, bounds);
}

for (const node of nodes.values()) {
    const cluster = clusterFor(node.type);
    const target = clusterLayout[cluster];
    const bounds = clusterBounds.get(cluster);
    const { x, y } = graph.getNodeAttributes(node.id);
    const middleX = (bounds.minX + bounds.maxX) / 2;
    const middleY = (bounds.minY + bounds.maxY) / 2;
    const span = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, 1);

    graph.setNodeAttribute(node.id, 'x', target.x + ((x - middleX) / span) * target.radius * 2);
    graph.setNodeAttribute(node.id, 'y', target.y + ((y - middleY) / span) * target.radius * 2);
}

const connected = new Map([...nodes.keys()].map(id => [id, new Set()]));
for (const edge of filteredEdges) {
    connected.get(edge.source)?.add(edge.target);
    connected.get(edge.target)?.add(edge.source);
}

await fs.rm(noteOutput, { recursive: true, force: true });
await fs.mkdir(noteOutput, { recursive: true });

for (const record of records) {
    if (!nodes.has(record.id)) continue;
    const html = renderMarkdown(record.body, target => {
        const resolved = resolveRecord(target);
        return resolved && nodes.has(resolved.id) ? resolved.id : null;
    });
    const related = [...(connected.get(record.id) || [])]
        .map(id => ({ id, label: nodes.get(id)?.label || id }))
        .sort((a, b) => a.label.localeCompare(b.label));

    await fs.writeFile(
        path.join(noteOutput, `${hashName(record.id)}.json`),
        `${JSON.stringify({ id: record.id, title: record.title, type: record.type, html, related })}\n`
    );
}

const manifestNodes = [...nodes.values()].map(node => {
    const position = graph.getNodeAttributes(node.id);
    const nodeDegree = degree.get(node.id) || 1;
    return {
        ...node,
        x: Number(position.x.toFixed(5)),
        y: Number(position.y.toFixed(5)),
        size: Number((0.9 + Math.min(Math.sqrt(nodeDegree) * 0.24, 2.5)).toFixed(2)),
    };
});

await fs.mkdir(graphOutput, { recursive: true });
await fs.writeFile(
    path.join(graphOutput, 'graph.json'),
    `${JSON.stringify({
        generatedAt: new Date().toISOString(),
        nodeCount: manifestNodes.length,
        edgeCount: filteredEdges.length,
        nodes: manifestNodes,
        edges: filteredEdges,
    })}\n`
);

const workItems = records
    .filter(record => record.id.startsWith('projects/'))
    .map(record => {
        const override = workOverrides[record.basename];
        const created = String(record.data.started || record.data.created || record.data.updated || '');
        return {
            id: record.basename,
            title: record.title,
            description: override?.description || String(record.data.description || excerptFromMarkdown(record.body)),
            year: override?.year || created.match(/\d{4}/)?.[0] || '',
            group: override?.group || 'built',
            link: override?.link || null,
        };
    })
    .concat(additionalWork)
    .sort((a, b) => a.title.localeCompare(b.title));

await fs.mkdir(path.dirname(workOutput), { recursive: true });
await fs.writeFile(workOutput, `${JSON.stringify(workItems, null, 2)}\n`);

console.log(`SecondBrain synced: ${manifestNodes.length} nodes, ${filteredEdges.length} edges, ${workItems.length} work items.`);
