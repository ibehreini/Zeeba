import type { ChangeEvent, CSSProperties } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { defaultFormatLabel, type NativeSelectProps } from './NativeSelect.shared';

/**
 * Web build of NativeSelect: a real <select>, styled to match the app's plain
 * form inputs.
 *
 * The native build renders a Pressable that carries the current selection in
 * `accessibilityValue`. That prop has no effect on web - react-native-web only
 * reads the flat `aria-valuetext` prop, and `aria-valuetext` is ignored on
 * `role="button"` anyway - and its `accessibilityLabel` overrides the button's
 * own text, so screen readers announced "Label, button" no matter what was
 * picked. A <select> gets that for free: the browser announces the role, the
 * accessible name and the *current option*, and re-announces on every change.
 *
 * It also brings real keyboard support (arrows, type-ahead, Home/End) and the
 * platform's own picker on mobile browsers.
 */
export default function NativeSelect<T extends string>({
  label,
  options,
  value,
  onChange,
  placeholder = 'Select...',
  required = false,
  allowClear = false,
  formatLabel = defaultFormatLabel,
}: NativeSelectProps<T>) {
  const { theme, isDark } = useTheme();

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const next = event.target.value;
    onChange(next === '' ? null : (next as T));
  };

  const selectStyle: CSSProperties = {
    width: '100%',
    height: 48,
    boxSizing: 'border-box',
    paddingLeft: 14,
    // Room for the chevron, which sits above the control and can't be clicked.
    paddingRight: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: theme.border,
    backgroundColor: theme.surfaceAlt,
    color: value ? theme.textPrimary : theme.textSecondary,
    fontFamily: 'inherit',
    fontSize: 16,
    appearance: 'none',
    WebkitAppearance: 'none',
    // The option list is drawn by the OS, not by us. `color-scheme` is the
    // only hook we have to keep it in step with the app's theme.
    colorScheme: isDark ? 'dark' : 'light',
  };

  return (
    <div style={{ position: 'relative' }}>
      <select
        value={value ?? ''}
        onChange={handleChange}
        aria-label={label}
        aria-required={required || undefined}
        style={selectStyle}
      >
        {/*
          The placeholder row. Disabled unless the field is clearable, so a
          required select can't be emptied again once answered - it still shows
          as the initial selection either way.
        */}
        <option value="" disabled={!allowClear}>
          {placeholder}
        </option>
        {options.map(option => (
          <option key={option} value={option}>
            {formatLabel(option)}
          </option>
        ))}
      </select>

      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          right: 14,
          top: '50%',
          transform: 'translateY(-50%)',
          pointerEvents: 'none',
          fontSize: 20,
          lineHeight: 1,
          color: theme.textSecondary,
        }}
      >
        ›
      </span>
    </div>
  );
}
