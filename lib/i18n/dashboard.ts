import { devicesTranslations } from './devices';
import { simcardsTranslations } from './simcards';

export const dashboardTranslations = {
  es: {
    ...devicesTranslations.es,
    ...simcardsTranslations.es,
  },
  en: {
    ...devicesTranslations.en,
    ...simcardsTranslations.en,
  },
  pt: {
    ...devicesTranslations.pt,
    ...simcardsTranslations.pt,
  },
  'zh-CN': {
    ...devicesTranslations['zh-CN'],
    ...simcardsTranslations['zh-CN'],
  },
};

export default dashboardTranslations;
