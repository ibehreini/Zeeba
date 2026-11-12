import { useEffect } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { announceForScreenReader } from '@/utils/announce';

/**
 * An error message that every screen reader hears when it appears: role="alert"
 * covers web, but iOS ignores it, so it is also announced there.
 */
export default function ErrorText({ children, style }: { children: string; style?: StyleProp<TextStyle> }) {
  useEffect(() => announceForScreenReader(children), [children]);
  return (
    <Text role="alert" style={style}>
      {children}
    </Text>
  );
}
