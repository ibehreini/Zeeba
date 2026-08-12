import type { PropsWithChildren } from 'react';

export type AppShellProps = PropsWithChildren<{
  /** Web-only: gates the header nav/footer. Unused on native. */
  signedIn: boolean;
}>;

/**
 * Native has no site chrome to add - the bottom tab bar and native stack
 * headers already carry navigation - so this is a pass-through. The web shell
 * (header nav, landmarks, footer) lives in AppShell.web.tsx.
 */
export default function AppShell({ children }: AppShellProps) {
  return <>{children}</>;
}
