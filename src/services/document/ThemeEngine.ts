import { TextStyle } from 'react-native';
import FontLoader from '../fonts/FontLoader';
import { OPEN_DYSLEXIC_CATALOG_LABEL } from './fontCatalog';

export function getReaderFontStyle(
  fontFamily: string,
  fontSize: number,
  lineSpacing: number,
  color: string
): TextStyle {
  const family =
    fontFamily === OPEN_DYSLEXIC_CATALOG_LABEL
      ? FontLoader.getOpenDyslexicRegularFamily()
      : fontFamily;

  return {
    fontFamily: family,
    fontSize,
    lineHeight: fontSize * lineSpacing,
    color,
    letterSpacing: fontFamily === OPEN_DYSLEXIC_CATALOG_LABEL ? 0.5 : 0,
  };
}
