export interface TweetMedia {
    url: string;
    alt?: string;
}

export interface TweetRecord {
    id: string;
    text: string;
    createdAt: string;
    url: string;
    conversationId?: string | null;
    inReplyTo?: string | null;
    media?: TweetMedia[];
}

export interface TweetEntry {
    id: string;
    createdAt: string;
    url: string;
    parts: TweetRecord[];
}

export function groupTweets(tweets: TweetRecord[]): TweetEntry[] {
    const sorted = [...tweets].sort(
        (a, b) => new Date(b.createdAt).valueOf() - new Date(a.createdAt).valueOf()
    );
    const ids = new Set(sorted.map(tweet => tweet.id));
    const ownThreadIds = new Set(
        sorted
            .map(tweet => tweet.conversationId)
            .filter((id): id is string => Boolean(id && ids.has(id)))
    );
    const grouped = new Map<string, TweetRecord[]>();
    const entries: TweetEntry[] = [];

    for (const tweet of sorted) {
        if (tweet.conversationId && ownThreadIds.has(tweet.conversationId)) {
            if (!grouped.has(tweet.conversationId)) grouped.set(tweet.conversationId, []);
            grouped.get(tweet.conversationId)?.push(tweet);
            continue;
        }
        entries.push({ id: tweet.id, createdAt: tweet.createdAt, url: tweet.url, parts: [tweet] });
    }

    for (const [threadId, parts] of grouped) {
        parts.sort((a, b) => new Date(a.createdAt).valueOf() - new Date(b.createdAt).valueOf());
        const root = parts.find(part => part.id === threadId) || parts[0];
        const latest = parts.at(-1) || root;
        entries.push({ id: root.id, createdAt: latest.createdAt, url: root.url, parts });
    }

    return entries.sort(
        (a, b) => new Date(b.createdAt).valueOf() - new Date(a.createdAt).valueOf()
    );
}
