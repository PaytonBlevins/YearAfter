import { vi } from 'vitest';

// Only native host boundaries are replaced. Shared rows, buttons, fields and
// their disabled/accessibility behavior execute in the component tests.
vi.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  TextInput: 'TextInput',
  Modal: 'Modal',
  StyleSheet: { create: <T>(styles: T): T => styles, hairlineWidth: 1 },
  Platform: {
    OS: 'ios',
    select: (values: { ios?: string; default?: string }) => values.ios ?? values.default,
  },
}));

vi.mock('react-native-svg', () => ({
  default: 'Svg',
  Circle: 'Circle',
  Path: 'Path',
  Rect: 'Rect',
  Line: 'Line',
  Polyline: 'Polyline',
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
