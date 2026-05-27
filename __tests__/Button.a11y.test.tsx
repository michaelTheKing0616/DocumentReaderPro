import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Button } from '../src/components/common/Button';

jest.mock('../src/theme/useTheme', () => ({
  useTheme: () => ({
    theme: {
      spacing: { md: 16, '2xl': 24, '4xl': 48 },
      radius: { md: 8 },
      typography: {
        body: { fontSize: 16 },
        label: { fontWeight: '600' as const },
      },
      colors: {
        primary: '#007AFF',
        accent: '#34C759',
        disabled: '#CCCCCC',
        disabledText: '#999999',
        textInverse: '#FFFFFF',
      },
    },
  }),
}));

function renderButton(props: Partial<React.ComponentProps<typeof Button>> = {}) {
  const onPress = jest.fn();
  const result = render(<Button title="Continue" onPress={onPress} {...props} />);
  return { ...result, onPress };
}

describe('Button accessibility', () => {
  it('exposes button role and label for screen readers', () => {
    const { getByRole } = renderButton({ title: 'Save changes' });
    const button = getByRole('button', { name: 'Save changes' });
    expect(button).toBeTruthy();
    expect(button.props.accessibilityState).toEqual({ disabled: false });
  });

  it('marks disabled state when loading', () => {
    const { getByRole } = renderButton({ loading: true });
    const button = getByRole('button');
    expect(button.props.accessibilityState).toEqual({ disabled: true });
    expect(button.props.accessibilityRole).toBe('button');
  });

  it('marks disabled state when disabled prop is set', () => {
    const { getByRole } = renderButton({ disabled: true });
    const button = getByRole('button');
    expect(button.props.accessibilityState).toEqual({ disabled: true });
  });

  it('does not invoke onPress when disabled', () => {
    const { getByRole, onPress } = renderButton({ disabled: true });
    fireEvent.press(getByRole('button'));
    expect(onPress).not.toHaveBeenCalled();
  });
});
