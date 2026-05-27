import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  ScrollView,
  Text,
  Image,
  ActivityIndicator,
  TouchableOpacity,
  Animated,
  Linking,
  Alert,
} from 'react-native';
import {
  PinchGestureHandler,
  PanGestureHandler,
  State,
  PinchGestureHandlerGestureEvent,
  PanGestureHandlerGestureEvent,
} from 'react-native-gesture-handler';
import Pdf from 'react-native-pdf';
import Highlighter from 'react-native-highlight-words';
import { Document } from '../../types';
import { ParsedDocument } from '../../services/document/types';
import DocumentLoaderService from '../../services/document/DocumentLoaderService';
import { getReaderFontStyle } from '../../services/document/ThemeEngine';
import { NavigationPanel } from './NavigationPanel';
import { SearchBar, SearchMatch } from './SearchBar';
import { logger } from '../../services/logger/Logger';
import { useTheme } from '../../theme/useTheme';
import { lightColors, darkColors } from '../../theme/colors';

const MIN_SCALE = 1;
const MAX_SCALE = 4;

export type ScrollMode = 'paged' | 'continuous';

export interface ReaderCanvasProps {
  document: Document;
  onPageChange?: (page: number) => void;
  fontSize?: number;
  lineSpacing?: number;
  fontFamily?: string;
  theme?: 'light' | 'dark' | 'sepia' | 'high-contrast';
  initialPage?: number;
  scrollMode?: ScrollMode;
}

type ThemeColors = { bg: string; text: string; accent: string; highlight: string };

function getThemeColors(theme: ReaderCanvasProps['theme'], isDark: boolean): ThemeColors {
  switch (theme) {
    case 'dark':
      return { bg: darkColors.background, text: darkColors.text, accent: darkColors.primary, highlight: '#FFD60A66' };
    case 'sepia':
      return { bg: '#F4E4BC', text: '#3E2723', accent: lightColors.primary, highlight: '#FF980066' };
    case 'high-contrast':
      return { bg: '#000000', text: '#FFFFFF', accent: '#FFFF00', highlight: '#FFFF0066' };
    default:
      return {
        bg: isDark ? darkColors.background : lightColors.background,
        text: isDark ? darkColors.text : lightColors.text,
        accent: isDark ? darkColors.primary : lightColors.primary,
        highlight: '#FFEB3B99',
      };
  }
}

export const ReaderCanvas: React.FC<ReaderCanvasProps> = ({
  document,
  onPageChange,
  fontSize = 16,
  lineSpacing = 1.5,
  fontFamily = 'System',
  theme = 'light',
  initialPage = 1,
  scrollMode = 'paged',
}) => {
  const appTheme = useTheme();
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [parsed, setParsed] = useState<ParsedDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [navVisible, setNavVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMatch, setActiveMatch] = useState<SearchMatch | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  const baseScale = useRef(new Animated.Value(1)).current;
  const pinchScale = useRef(new Animated.Value(1)).current;
  const scale = Animated.multiply(baseScale, pinchScale);
  const baseTranslateX = useRef(new Animated.Value(0)).current;
  const baseTranslateY = useRef(new Animated.Value(0)).current;
  const panTranslateX = useRef(new Animated.Value(0)).current;
  const panTranslateY = useRef(new Animated.Value(0)).current;
  const translateX = Animated.add(baseTranslateX, panTranslateX);
  const translateY = Animated.add(baseTranslateY, panTranslateY);
  const lastScaleRef = useRef(1);
  const panOffsetX = useRef(0);
  const panOffsetY = useRef(0);
  const [isZoomed, setIsZoomed] = useState(false);

  const colors = getThemeColors(theme, appTheme.colorScheme === 'dark');
  const readerFontStyle = getReaderFontStyle(fontFamily, fontSize, lineSpacing, colors.text);
  const uiFontStyle = getReaderFontStyle(fontFamily, 14, 1.4, colors.text);
  const accentFontStyle = getReaderFontStyle(fontFamily, 15, 1.4, colors.accent);

  const handlePageChange = useCallback(
    (page: number) => {
      setCurrentPage(page);
      onPageChange?.(page);
    },
    [onPageChange]
  );

  useEffect(() => {
    let cancelled = false;

    const loadContent = async () => {
      setLoading(true);
      setError(null);

      try {
        const result = await DocumentLoaderService.load(document.filePath, document.format, {
          documentId: document.id,
          title: document.title,
          index: document.format !== 'pdf',
        });
        if (!cancelled) {
          setParsed(result);
          handlePageChange(Math.min(initialPage, result.pageCount));
        }
      } catch (loadError) {
        if (!cancelled) {
          const message =
            loadError instanceof Error ? loadError.message : 'Failed to load document';
          logger.error('ReaderCanvas load failed', { documentId: document.id, message });
          setError(message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadContent();
    return () => {
      cancelled = true;
    };
  }, [document, initialPage, handlePageChange]);

  useEffect(() => {
    setCurrentPage(initialPage);
  }, [initialPage]);

  const pageCount = parsed?.pageCount ?? document.pageCount ?? 1;
  const pages = parsed?.pages ?? [];
  const currentPageText =
    pages.find((page) => page.pageNumber === currentPage)?.text ??
    parsed?.text ??
    '';

  const handlePinchEvent = Animated.event(
    [{ nativeEvent: { scale: pinchScale } }],
    { useNativeDriver: true }
  );

  const handlePinchStateChange = useCallback(
    (event: PinchGestureHandlerGestureEvent) => {
      if (event.nativeEvent.state === State.END) {
        const nextScale = Math.min(
          MAX_SCALE,
          Math.max(MIN_SCALE, lastScaleRef.current * event.nativeEvent.scale)
        );
        lastScaleRef.current = nextScale;
        baseScale.setValue(nextScale);
        pinchScale.setValue(1);
        setIsZoomed(nextScale > MIN_SCALE);
      }
    },
    [baseScale, pinchScale]
  );

  const handlePanEvent = Animated.event(
    [{ nativeEvent: { translationX: panTranslateX, translationY: panTranslateY } }],
    { useNativeDriver: true }
  );

  const handlePanStateChange = useCallback(
    (event: PanGestureHandlerGestureEvent) => {
      if (event.nativeEvent.state === State.END) {
        panOffsetX.current += event.nativeEvent.translationX;
        panOffsetY.current += event.nativeEvent.translationY;
        baseTranslateX.setValue(panOffsetX.current);
        baseTranslateY.setValue(panOffsetY.current);
        panTranslateX.setValue(0);
        panTranslateY.setValue(0);
      }
    },
    [baseTranslateX, baseTranslateY, panTranslateX, panTranslateY]
  );

  const resetZoom = useCallback(() => {
    lastScaleRef.current = 1;
    panOffsetX.current = 0;
    panOffsetY.current = 0;
    baseScale.setValue(1);
    pinchScale.setValue(1);
    baseTranslateX.setValue(0);
    baseTranslateY.setValue(0);
    panTranslateX.setValue(0);
    panTranslateY.setValue(0);
    setIsZoomed(false);
  }, [baseScale, baseTranslateY, baseTranslateX, panTranslateX, panTranslateY, pinchScale]);

  const handlePdfLinkPress = useCallback((uri: string) => {
    Linking.openURL(uri).catch((linkError) => {
      logger.warn('ReaderCanvas link open failed', {
        uri,
        message: linkError instanceof Error ? linkError.message : String(linkError),
      });
      Alert.alert('Link', uri);
    });
  }, []);

  const searchWords = useMemo(
    () => (searchQuery.trim().length >= 2 ? [searchQuery.trim()] : []),
    [searchQuery]
  );

  const renderZoomable = (content: React.ReactNode) => (
    <PanGestureHandler
      onGestureEvent={handlePanEvent}
      onHandlerStateChange={handlePanStateChange}
      minPointers={1}
      maxPointers={1}
    >
      <Animated.View style={styles.flex}>
        <PinchGestureHandler
          onGestureEvent={handlePinchEvent}
          onHandlerStateChange={handlePinchStateChange}
        >
          <Animated.View
            style={[
              styles.flex,
              {
                transform: [{ translateX }, { translateY }, { scale }],
              },
            ]}
          >
            {content}
          </Animated.View>
        </PinchGestureHandler>
      </Animated.View>
    </PanGestureHandler>
  );

  const renderPdf = () => (
    <View style={styles.flex}>
      {renderZoomable(
        <Pdf
          source={{ uri: document.filePath }}
          style={styles.pdf}
          page={scrollMode === 'paged' ? currentPage : undefined}
          onPageChanged={(page, numberOfPages) => {
            if (scrollMode === 'paged') {
              handlePageChange(page);
            }
            if (numberOfPages > 0) {
              setParsed((prev) => ({
                text: prev?.text ?? '',
                pageCount: numberOfPages,
                toc: prev?.toc,
                pages: prev?.pages,
              }));
            }
          }}
          enablePaging={scrollMode === 'paged'}
          horizontal={false}
          fitPolicy={0}
          onPressLink={handlePdfLinkPress}
          trustAllCerts={false}
        />
      )}
      {isZoomed && (
        <TouchableOpacity style={styles.resetZoomButton} onPress={resetZoom}>
          <Text style={[styles.resetZoomText, accentFontStyle]}>Reset zoom</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderImage = () => (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.bg }]}
      contentContainerStyle={styles.imageContainer}
    >
      {renderZoomable(
        <Image
          source={{ uri: document.filePath }}
          style={styles.image}
          resizeMode="contain"
          accessibilityLabel={document.title}
        />
      )}
      {currentPageText.length > 0 && (
        <View style={styles.ocrSection}>
          <Text style={[styles.ocrLabel, uiFontStyle]}>Extracted text</Text>
          {searchWords.length > 0 ? (
            <Highlighter
              searchWords={searchWords}
              textToHighlight={currentPageText}
              style={[styles.text, readerFontStyle]}
              highlightStyle={[styles.highlight, { backgroundColor: colors.highlight }]}
            />
          ) : (
            <Text style={[styles.text, readerFontStyle]}>{currentPageText}</Text>
          )}
        </View>
      )}
    </ScrollView>
  );

  const renderText = () => (
    <ScrollView
      ref={scrollViewRef}
      style={[styles.container, { backgroundColor: colors.bg }]}
      contentContainerStyle={styles.textContainer}
    >
      {searchWords.length > 0 && currentPageText.length > 0 ? (
        <Highlighter
          searchWords={searchWords}
          textToHighlight={currentPageText}
          style={[styles.text, readerFontStyle]}
          highlightStyle={[styles.highlight, { backgroundColor: colors.highlight }]}
        />
      ) : (
        <Text style={[styles.text, readerFontStyle]}>
          {currentPageText || 'No content available.'}
        </Text>
      )}
    </ScrollView>
  );

  const renderBody = () => {
    if (loading) {
      return (
        <View style={[styles.centered, { backgroundColor: colors.bg }]}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.loadingText, uiFontStyle]}>Loading document…</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={[styles.centered, { backgroundColor: colors.bg }]}>
          <Text style={[styles.errorText, readerFontStyle]}>{error}</Text>
        </View>
      );
    }

    if (document.format === 'pdf') {
      return renderPdf();
    }

    if (document.format === 'image') {
      return renderImage();
    }

    return renderText();
  };

  const showFooter = scrollMode === 'paged' || document.format !== 'pdf';

  return (
    <View style={[styles.wrapper, { backgroundColor: colors.bg }]}>
      {pages.length > 0 && (
        <SearchBar
          pages={pages}
          currentPage={currentPage}
          onJumpToPage={handlePageChange}
          onQueryChange={setSearchQuery}
          onMatchChange={setActiveMatch}
          fontFamily={fontFamily}
          fontSize={fontSize}
          accentColor={colors.accent}
          textColor={colors.text}
          backgroundColor={colors.bg}
        />
      )}

      {renderBody()}

      {showFooter && (
        <View style={[styles.footer, { backgroundColor: colors.bg, borderTopColor: '#E0E0E0' }]}>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => handlePageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
            accessibilityLabel="Previous page"
          >
            <Text style={[styles.navButtonText, accentFontStyle]}>‹ Prev</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.pageIndicator}
            onPress={() => setNavVisible(true)}
            accessibilityLabel="Open navigation"
          >
            <Text style={[styles.pageIndicatorText, uiFontStyle]}>
              {currentPage} / {pageCount}
              {activeMatch ? ` • match ${activeMatch.globalIndex + 1}` : ''}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navButton}
            onPress={() => handlePageChange(Math.min(pageCount, currentPage + 1))}
            disabled={currentPage >= pageCount}
            accessibilityLabel="Next page"
          >
            <Text style={[styles.navButtonText, accentFontStyle]}>Next ›</Text>
          </TouchableOpacity>
        </View>
      )}

      <NavigationPanel
        visible={navVisible}
        onClose={() => setNavVisible(false)}
        toc={parsed?.toc}
        currentPage={currentPage}
        pageCount={pageCount}
        onJumpToPage={handlePageChange}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  pdf: {
    flex: 1,
    width: Dimensions.get('window').width,
  },
  textContainer: {
    padding: 20,
    paddingBottom: 80,
  },
  text: {
    textAlign: 'left',
  },
  highlight: {
    borderRadius: 2,
  },
  imageContainer: {
    padding: 16,
    paddingBottom: 80,
  },
  image: {
    width: '100%',
    height: Dimensions.get('window').height * 0.45,
    marginBottom: 16,
  },
  ocrSection: {
    marginTop: 8,
  },
  ocrLabel: {
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    opacity: 0.7,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
  },
  errorText: {
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  navButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: 72,
  },
  navButtonText: {
    fontWeight: '600',
  },
  pageIndicator: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  pageIndicatorText: {
    fontWeight: '600',
  },
  resetZoomButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  resetZoomText: {
    fontWeight: '600',
  },
});

export default ReaderCanvas;
