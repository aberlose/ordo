import type { Decorator, Preview } from '@storybook/react-vite';
import { useEffect } from 'react';
import '../src/renderer/i18n';
import i18n from '../src/renderer/i18n';
import '../src/renderer/styles/index.css';

/** Every story renders in the chosen colour theme, mode and language (toolbar). */
const withAppearance: Decorator = (Story, context) => {
  const { palette, mode, locale } = context.globals as { palette: string; mode: string; locale: string };
  useEffect(() => {
    document.documentElement.dataset['palette'] = palette;
    document.documentElement.dataset['mode'] = mode;
    void i18n.changeLanguage(locale);
  }, [palette, mode, locale]);
  return <Story />;
};

const preview: Preview = {
  decorators: [withAppearance],
  parameters: { layout: 'fullscreen' },
  initialGlobals: { palette: 'ciel', mode: 'light', locale: 'fr' },
  globalTypes: {
    palette: {
      description: 'Colour theme',
      toolbar: {
        icon: 'paintbrush',
        items: ['ciel', 'aurore', 'lavande', 'indigo', 'corail'],
        dynamicTitle: true,
      },
    },
    mode: {
      description: 'Light or dark',
      toolbar: { icon: 'mirror', items: ['light', 'dark'], dynamicTitle: true },
    },
    locale: {
      description: 'Language',
      toolbar: { icon: 'globe', items: ['fr', 'en'], dynamicTitle: true },
    },
  },
};

export default preview;
