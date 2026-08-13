/**
 * Contract shared by the platform builds of NativeSelect (NativeSelect.tsx
 * for iOS/Android, NativeSelect.web.tsx for web). Metro picks one file per
 * platform and TypeScript only ever checks callers against one of them, so
 * without this shared type the two builds' APIs could silently fork.
 */
export type NativeSelectProps<T extends string> = {
  label: string;
  options: readonly T[];
  value: T | null;
  onChange: (value: T | null) => void;
  placeholder?: string;
  required?: boolean;
  /** Shows a "Clear" option so the field can be reset to null. Use for optional selects. */
  allowClear?: boolean;
  formatLabel?: (value: T) => string;
};

/** Turns a snake_case option value into a Title Case label. */
export function defaultFormatLabel(value: string): string {
  return value
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
