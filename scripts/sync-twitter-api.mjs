import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = path.join(root, 'src', 'data', 'tweets.json');
const bearerToken = process.env.X_BEARER_TOKEN;

if (!bearerToken) {
    console.log('X_BEARER_TOKEN is not configured; keeping the existing tweet archive.');
    process.exit(0);
}

const current = JSON.parse(await fs.readFile(outputPath, 'utf8'));
const handle = process.env.X_USERNAME || current.handle || 'ygs_wrld';
const headers = { Authorization: `Bearer ${bearerToken}` };

const userResponse = await fetch(`https://api.x.com/2/users/by/username/${encodeURIComponent(handle)}`, { headers });
if (!userResponse.ok) throw new Error(`X user lookup failed: ${userResponse.status}`);
const user = (await userResponse.json()).data;

const query = new URLSearchParams({
    max_results: '100',
    exclude: 'retweets',
    'tweet.fields': 'created_at,conversation_id,in_reply_to_user_id,referenced_tweets,attachments',
    expansions: 'attachments.media_keys',
    'media.fields': 'url,preview_image_url,alt_text,type',
});

const tweetsResponse = await fetch(`https://api.x.com/2/users/${user.id}/tweets?${query}`, { headers });
if (!tweetsResponse.ok) throw new Error(`X posts lookup failed: ${tweetsResponse.status}`);
const payload = await tweetsResponse.json();
const mediaByKey = new Map((payload.includes?.media || []).map(media => [media.media_key, media]));

const latest = (payload.data || []).map(tweet => ({
    id: tweet.id,
    text: tweet.text,
    createdAt: tweet.created_at,
    url: `https://x.com/${handle}/status/${tweet.id}`,
    conversationId: tweet.conversation_id || tweet.id,
    inReplyTo: tweet.referenced_tweets?.find(reference => reference.type === 'replied_to')?.id || null,
    media: (tweet.attachments?.media_keys || [])
        .map(key => mediaByKey.get(key))
        .filter(Boolean)
        .map(media => ({
            url: media.url || media.preview_image_url,
            alt: media.alt_text || '',
        }))
        .filter(media => Boolean(media.url)),
}));

const merged = new Map(current.tweets.map(tweet => [tweet.id, tweet]));
for (const tweet of latest) merged.set(tweet.id, tweet);

const tweets = [...merged.values()].sort(
    (a, b) => new Date(b.createdAt).valueOf() - new Date(a.createdAt).valueOf()
);

await fs.writeFile(outputPath, `${JSON.stringify({ handle, updatedAt: new Date().toISOString(), tweets }, null, 2)}\n`);
console.log(`X latest sync complete: ${latest.length} fetched, ${tweets.length} total.`);
