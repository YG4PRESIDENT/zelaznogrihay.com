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
        year: '2022', group: 'built', link: null,
    },
    'austin-treasure-map': {
        description: 'A gamified map of 90+ hand-picked Austin places built for finding a new local adventure.',
        year: '2026', group: 'built', link: 'https://yg4president.github.io/austin-treasure-map/',
    },
    brotein: {
        description: 'An iOS nutrition app for scanning menus and evaluating meals for their muscle-building potential.',
        year: '2025', group: 'built', link: null,
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
        year: '2026', group: 'built', link: 'https://rankett.com',
    },
    swipr: {
        description: 'A swipe-based prediction product built around short sessions and accuracy-based outcomes. Built, but not fully released.',
        year: '2026', group: 'built', link: null,
    },
    'youtube-tool': {
        title: 'YouTube Tooling',
        description: 'A hosted Rankett tool for turning YouTube content into AI-visibility work. Built, but not fully released.',
        year: '2026', group: 'built', link: null,
    },
};

const excludedWorkIds = new Set([
    'insight-ai',
    'irl-lore',
    'snap-map-app',
    'te-amo',
    'vrtl-bet',
    'wagerwrld',
]);

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
        id: 'mlb-kalshi-luck-bot', title: 'MLB Kalshi Luck Bot',
        description: 'A live-game MLB paper-trading research harness with a luck-adjusted win-probability model. Built, but not fully released.',
        year: '2026', group: 'built', link: null,
    },
    {
        id: 'sante-designs', title: 'Sante Designs',
        description: 'A custom fashion and graphic-design brand website built with motion-led interactions.',
        year: '2026', group: 'built', link: 'https://github.com/YG4PRESIDENT/santedesigns.com',
    },
];

const ideaWork = [
    {
        id: 'bromenu', title: 'BroMenu',
        description: 'Find the most anabolic menu item for hitting your protein goals.',
    },
    {
        id: 'swipe-prediction-betting', title: 'Swipe Prediction Betting',
        description: 'A TikTok-style feed of micro-predictions: swipe left or right, with payouts based on prediction accuracy.',
    },
    {
        id: 'clash-royale-betting', title: 'Clash Royale Betting',
        description: 'A betting experience built around Clash Royale matches.',
    },
    {
        id: 'weed-snack-drive-thru', title: 'Weed + Snack Drive-Thru',
        description: 'A drive-thru combining cannabis and snacks in one stop.',
    },
    {
        id: 'midnight-ghost-kitchen', title: 'Regional Midnight Ghost Kitchen',
        description: 'A late-night regional ghost kitchen aimed at tech workers.',
    },
    {
        id: 'horse-saas', title: 'Horse SaaS',
        description: 'Software for the horse industry, with AI built into the workflow.',
    },
    {
        id: 'horse-marketplace', title: 'Horse Marketplace',
        description: 'A market for horse rights, breeding and semen, and track tickets—with a possible public-market layer for retail participation.',
    },
    {
        id: 'immigration-turbotax', title: 'TurboTax for Immigration',
        description: 'A guided platform that makes immigration paperwork and process navigation simpler.',
    },
    {
        id: 'interface-less-hotels', title: 'Interface-Less Hotels',
        description: 'Remove the human middle layer from hotel check-in and related security workflows.',
    },
    {
        id: 'friend-bets', title: 'Friend Bets',
        description: 'Generate simple live odds for one-on-one bets with friends, including group bets where participation changes the odds.',
    },
    {
        id: 'wrld-sidequests', title: 'Wrld Sidequests',
        description: 'Real-world quests created by a central creator or contributed geocache-style by the community, then approved and published.',
    },
    {
        id: 'personal-ai-entity', title: 'Personal AI Entity',
        description: 'An online AI avatar that acts as a persistent extension of a person.',
    },
    {
        id: 'activity-status-widget', title: 'Activity Status Widget',
        description: 'Tap once to automatically tell selected people what you are doing and keep yourself accountable.',
    },
    {
        id: 'carbuddy', title: 'CarBUDDY',
        description: 'A conversational AI companion that curates useful, enjoyable conversations while you drive.',
    },
    {
        id: 'virtual-of-models', title: 'Virtual OF Models',
        description: 'AI-created virtual models and the tools needed to operate them as online creators.',
    },
    {
        id: 'ai-seo', title: 'AI SEO',
        description: 'Tools and services for helping brands appear inside AI-generated search and answers.',
    },
    {
        id: 'imessage-diet-set', title: 'iMessage Diet + Set App',
        description: 'A diet and set-tracking experience operated through iMessage.',
    },
    {
        id: 'werun-in-america', title: 'WeRun in America',
        description: 'An early product and brand concept.',
    },
    {
        id: 'midshinpants', title: 'MidShinPants.com',
        description: 'A focused apparel brand built around mid-shin-length pants.',
    },
    {
        id: 'community-app', title: 'Community App',
        description: 'A product concept centered on making a real community easier to form and sustain.',
    },
    {
        id: 'sushi-train-austin', title: 'Sushi Train',
        description: 'An Austin restaurant built around conveyor-belt sushi, named “Sushi Train.”',
    },
    {
        id: 'china-us-arbitrage', title: 'China–U.S. Arbitrage',
        description: 'Find product and market arbitrage opportunities between China and the United States.',
    },
    {
        id: 'livestream-commerce', title: 'Livestream Commerce',
        description: 'Sell products live through personality-led streaming and real-time audience interaction.',
    },
    {
        id: 'restaurant-qr-infrastructure', title: 'Restaurant QR Infrastructure',
        description: 'Make QR-based ordering and interaction a standard layer across restaurants.',
    },
    {
        id: 'delivery-food-lockers', title: 'Delivery Food Lockers',
        description: 'Secure pickup lockers for delivery food in dense and high-traffic areas.',
    },
    {
        id: 'group-buying', title: 'Pinduoduo-Style Group Buying',
        description: 'Bring social, group-based purchasing mechanics into a new market.',
    },
    {
        id: 'conveyor-hotpot', title: 'Conveyor Hotpot',
        description: 'A hotpot restaurant organized around a conveyor-service format.',
    },
    {
        id: 'friend-group-steps', title: 'Friend-Group Steps in WeChat',
        description: 'A shared step-tracking layer embedded directly into a friend group’s chat.',
    },
    {
        id: 'location-status-hotbar', title: 'Location Status Hotbar',
        description: 'A Find My or Life360 layer that communicates activity through colors and can trigger emergency alerts or police calls.',
    },
].map(item => ({ ...item, year: '', group: 'ideas', link: null }));

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
    .filter(record => record.id.startsWith('projects/') && !excludedWorkIds.has(record.basename))
    .map(record => {
        const override = workOverrides[record.basename];
        const created = String(record.data.started || record.data.created || record.data.updated || '');
        return {
            id: record.basename,
            title: override?.title || record.title,
            description: override?.description || String(record.data.description || excerptFromMarkdown(record.body)),
            year: override?.year || created.match(/\d{4}/)?.[0] || '',
            group: override?.group || 'built',
            link: override?.link || null,
        };
    })
    .concat(additionalWork)
    .concat(ideaWork)
    .sort((a, b) => a.title.localeCompare(b.title));

await fs.mkdir(path.dirname(workOutput), { recursive: true });
await fs.writeFile(workOutput, `${JSON.stringify(workItems, null, 2)}\n`);

console.log(`SecondBrain synced: ${manifestNodes.length} nodes, ${filteredEdges.length} edges, ${workItems.length} work items.`);
