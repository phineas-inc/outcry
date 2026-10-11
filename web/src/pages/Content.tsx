import { useEffect } from "react";
import { Link } from "react-router-dom";

const useTitle = (t: string) => useEffect(() => { document.title = `${t} — Outcry`; }, [t]);

export function Method() {
  useTitle("How it works");
  return (
    <main className="page prose">
      <span className="eyebrow">How it works</span>
      <h1 className="page-title">Read the whole spectrum before you raise your voice.</h1>
      <h2>Coverage, not verdicts</h2>
      <p>Every movement shows how its coverage splits between Left, Center and Right outlets. When one side is almost missing (under 10%) we flag a <b>blindspot</b>, so you know whose story you may not be hearing.</p>
      <h2>Two questions, two votes</h2>
      <p>Supporting a <em>cause</em> and supporting the <em>action</em> taken for it are different things, so you vote on each separately.</p>
      <h2>Voice: quadratic voting</h2>
      <p>You get 10 Voice a day. A vote of strength 1 costs 1, strength 2 costs 4, strength 3 costs 9, so caring a lot about one thing costs more than a little about many. Hold a vote button longer to raise its strength.</p>
      <h2>Earn the stronger votes</h2>
      <p>Strength 2 and 3 unlock for a movement once you've opened one article from each perspective. Reading all three sides earns XP and keeps your daily Bridge streak alive.</p>
      <h2>Where the data comes from</h2>
      <p>Every hour a bot reads public RSS feeds from outlets across the spectrum, keeps headlines that look like protest coverage, and uses an AI model to check which are real protests and where they happen. Stories reported by at least two outlets (or three articles) become movements on the map.</p>
      <p>Each movement links to the original articles. Titles and summaries are <b>AI-written from the headlines only</b> and can be wrong, so always check the sources. Crowd sizes appear only when a headline states one, and are reported figures, not verified counts.</p>
      <p>Left / Center / Right labels are <b>approximate</b>, based on widely cited public media-bias ratings, and bias ratings are contested. Outlets we haven't rated count as sources but aren't part of the lean split. The outlet list is open source, so you can challenge it.</p>
      <h2>Voting needs every available side</h2>
      <p>If only one perspective has covered a story, stronger votes stay locked until another side reports on it. That gap is the blindspot.</p>
      <p><Link className="cta" to="/app">Open the desk</Link></p>
    </main>
  );
}

export function Privacy() {
  useTitle("Privacy");
  return (
    <main className="page prose">
      <span className="eyebrow">Privacy</span>
      <h1 className="page-title">No accounts. No tracking.</h1>
      <p>Outcry creates a random identifier on your device the first time you vote or read. It lets the server enforce your daily Voice budget and remember your progress. It isn't linked to your name, email, contact details or location, and we don't use ad or analytics trackers.</p>
      <h2>What is stored</h2>
      <p>Your random device identifier, which movements you voted on and with what strength, which perspectives you've read, and your XP and streak.</p>
      <h2>Deleting your data</h2>
      <p>Clearing this site's data in your browser (or uninstalling the app) removes the identifier from your device. Open an issue on the repository and include the identifier from your browser storage if you want server-side records removed.</p>
      <p>Outcry is open source: <a href="https://github.com/tahire29-spec/outcry" target="_blank" rel="noreferrer">github.com/tahire29-spec/outcry</a>.</p>
    </main>
  );
}
