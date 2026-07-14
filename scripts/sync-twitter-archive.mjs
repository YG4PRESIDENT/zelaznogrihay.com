import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = path.join(root, 'src', 'data', 'tweets.json');
const downloads = path.join(process.env.HOME || '', 'Downloads');

async function newestArchive() {
    let entries = [];
    try {
        entries = await fs.readdir(downloads, { withFileTypes: true });
    } catch {
        return null;
    }

    const candidates = [];
    for (const entry of entries) {
        if (!entry.isFile() || !/^(twitter|x).*\.zip$/i.test(entry.name)) continue;
        const absolute = path.join(downloads, entry.name);
        const stat = await fs.stat(absolute);
        candidates.push({ absolute, mtime: stat.mtimeMs });
    }
    candidates.sort((a, b) => b.mtime - a.mtime);
    return candidates[0]?.absolute || null;
}

function parsePrefixedJson(source) {
    const start = source.indexOf('[');
    if (start === -1) throw new Error('X archive data did not contain a JSON array.');
    return JSON.parse(source.slice(start).replace(/;\s*$/, ''));
}

function expandText(tweet) {
    let text = String(tweet.full_text || tweet.text || '').trim();
    for (const url of tweet.entities?.urls || []) {
        if (url.url && url.expanded_url) text = text.replaceAll(url.url, url.expanded_url);
    }
    for (const media of tweet.entities?.media || tweet.extended_entities?.media || []) {
        if (media.url) text = text.replaceAll(media.url, '').trim();
    }
    return text;
}

const archivePath = path.resolve(process.argv[2] || process.env.TWITTER_ARCHIVE_PATH || await newestArchive() || '');
if (!archivePath) {
    console.log('No X archive found. Place the downloaded archive in ~/Downloads and run npm run sync:tweets.');
    process.exit(0);
}

const { stdout: listing } = await execFileAsync('unzip', ['-Z1', archivePath], { maxBuffer: 20 * 1024 * 1024 });
const files = listing.split('\n').filter(Boolean);
const tweetFiles = files.filter(file => /(^|\/)data\/tweets(?:-part\d+)?\.js$/i.test(file));

if (tweetFiles.length === 0) throw new Error(`No data/tweets*.js files found in ${archivePath}`);

let handle = 'ygs_wrld';
const accountFile = files.find(file => /(^|\/)data\/account\.js$/i.test(file));
if (accountFile) {
    const { stdout } = await execFileAsync('unzip', ['-p', archivePath, accountFile], { maxBuffer: 20 * 1024 * 1024 });
    const account = parsePrefixedJson(stdout)?.[0]?.account;
    handle = account?.username || account?.screen_name || handle;
}

const records = [];
for (const file of tweetFiles) {
    const { stdout } = await execFileAsync('unzip', ['-p', archivePath, file], { maxBuffer: 150 * 1024 * 1024 });
    records.push(...parsePrefixedJson(stdout));
}

const tweets = records
    .map(record => record.tweet || record)
    .filter(tweet => tweet.id_str && tweet.full_text && !/^RT\s+@/i.test(tweet.full_text))
    .map(tweet => {
        const mediaSource = tweet.extended_entities?.media || tweet.entities?.media || [];
        return {
            id: String(tweet.id_str),
            text: expandText(tweet),
            createdAt: new Date(tweet.created_at).toISOString(),
            url: `https://x.com/${handle}/status/${tweet.id_str}`,
            conversationId: String(tweet.conversation_id_str || tweet.id_str),
            inReplyTo: tweet.in_reply_to_status_id_str ? String(tweet.in_reply_to_status_id_str) : null,
            media: mediaSource
                .map(media => ({
                    url: media.media_url_https || media.media_url,
                    alt: media.ext_alt_text || '',
                }))
                .filter(media => Boolean(media.url)),
        };
    })
    .sort((a, b) => new Date(b.createdAt).valueOf() - new Date(a.createdAt).valueOf());

await fs.writeFile(outputPath, `${JSON.stringify({ handle, updatedAt: new Date().toISOString(), tweets }, null, 2)}\n`);
console.log(`X archive synced: ${tweets.length} authored posts for @${handle}.`);
