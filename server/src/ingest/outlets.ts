import type { Lean } from "../../../shared/rules.ts";

/**
 * Outlet → political lean, bucketed into Left / Center / Right.
 * These are APPROXIMATIONS based on widely cited public media-bias ratings (e.g. AllSides "lean left" → Left,
 * "lean right" → Right). Bias ratings are contested; edit this file to change them. Outlets not listed are
 * shown as sources but excluded from the lean split.
 */
export const LEAN_BY_DOMAIN: Record<string, Lean> = {
  "theguardian.com": "Left", "nytimes.com": "Left", "npr.org": "Left", "washingtonpost.com": "Left", "cnn.com": "Left",
  "msnbc.com": "Left", "huffpost.com": "Left", "vox.com": "Left", "slate.com": "Left", "theatlantic.com": "Left",
  "independent.co.uk": "Left", "aljazeera.com": "Left", "democracynow.org": "Left", "jacobin.com": "Left", "motherjones.com": "Left",
  "thenation.com": "Left", "theintercept.com": "Left", "rollingstone.com": "Left", "latimes.com": "Left", "nbcnews.com": "Left",
  "abcnews.go.com": "Left", "usatoday.com": "Left", "newyorker.com": "Left", "buzzfeednews.com": "Left",
  "bbc.com": "Center", "bbc.co.uk": "Center", "abc.net.au": "Center", "reuters.com": "Center", "apnews.com": "Center", "bloomberg.com": "Center",
  "axios.com": "Center", "thehill.com": "Center", "csmonitor.com": "Center", "france24.com": "Center", "dw.com": "Center",
  "euronews.com": "Center", "upi.com": "Center", "newsweek.com": "Center", "cbsnews.com": "Center", "news.sky.com": "Center",
  "foxnews.com": "Right", "nypost.com": "Right", "breitbart.com": "Right", "dailywire.com": "Right", "washingtontimes.com": "Right",
  "nationalreview.com": "Right", "telegraph.co.uk": "Right", "spectator.co.uk": "Right", "dailymail.co.uk": "Right", "thesun.co.uk": "Right",
  "wsj.com": "Right", "washingtonexaminer.com": "Right", "theblaze.com": "Right", "newsmax.com": "Right", "thefederalist.com": "Right",
  "gbnews.com": "Right", "reason.com": "Right",
};

export function leanOf(domain: string): Lean | null {
  const d = domain.toLowerCase().replace(/^www\./, "");
  for (const key in LEAN_BY_DOMAIN) if (d === key || d.endsWith("." + key)) return LEAN_BY_DOMAIN[key];
  return null;
}

/** RSS feeds polled hourly (public syndication feeds), in two groups so each cron invocation stays small. */
export const FEED_GROUPS: string[][] = [
  [
    "http://feeds.bbci.co.uk/news/world/rss.xml", "https://www.theguardian.com/world/rss", "https://www.aljazeera.com/xml/rss/all.xml",
    "https://feeds.npr.org/1004/rss.xml", "https://rss.nytimes.com/services/xml/rss/nyt/World.xml", "https://rss.dw.com/rdf/rss-en-world",
    "https://www.france24.com/en/rss", "https://www.independent.co.uk/news/world/rss", "https://www.cbsnews.com/latest/rss/world",
    "https://feeds.skynews.com/feeds/rss/world.xml", "https://thehill.com/news/feed/", "https://moxie.foxnews.com/google-publisher/world.xml",
    "https://nypost.com/news/feed/", "https://www.telegraph.co.uk/news/rss.xml", "https://www.washingtontimes.com/rss/headlines/news/world/",
    "https://www.nationalreview.com/feed/", "https://feeds.washingtonpost.com/rss/world", "https://www.latimes.com/world-nation/rss2.0.xml",
    "https://www.washingtonexaminer.com/feed", "https://www.newsweek.com/rss",
  ],
  [
    "https://www.thehindu.com/news/international/feeder/default.rss", "https://www.hindustantimes.com/feeds/rss/world-news/rssfeed.xml",
    "https://www.scmp.com/rss/91/feed", "https://www.straitstimes.com/news/world/rss.xml", "https://www.japantimes.co.jp/feed/",
    "https://www.abc.net.au/news/feed/2942460/rss.xml", "https://www.smh.com.au/rss/world.xml", "https://www.timesofisrael.com/feed/",
    "https://www.arabnews.com/rss.xml", "https://www.middleeasteye.net/rss", "https://kyivindependent.com/news-archive/rss/",
    "https://www.euronews.com/rss?format=mrss", "https://www.rfi.fr/en/rss", "https://en.mercopress.com/rss", "https://www.africanews.com/feed/rss",
    "https://www.channelnewsasia.com/rssfeeds/8395986", "https://globalnews.ca/world/feed/", "https://www.rte.ie/feeds/rss/?index=/news/world/",
    "https://www.csmonitor.com/layout/set/rss/World",
  ],
];
