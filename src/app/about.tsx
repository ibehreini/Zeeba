import { Redirect } from 'expo-router';

/**
 * /about was the Logs tab before Logs moved into Settings. It is still a
 * claimed universal link (public/.well-known/apple-app-site-association,
 * app.config.ts) and may be bookmarked, so it forwards to the new screen
 * instead of landing on +not-found. withAnchor loads Settings underneath, so
 * Back from Logs goes to Settings.
 */
export default function LegacyLogsRedirect() {
  return <Redirect href="/settings/logs" withAnchor />;
}
