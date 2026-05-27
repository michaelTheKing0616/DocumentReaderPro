import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ParsedPage } from '../../services/document/types';
import { getReaderFontStyle } from '../../services/document/ThemeEngine';
import { Text as ThemedText } from '../ui/Text';
import { useTheme } from '../../theme/useTheme';

export interface SearchMatch {
  pageNumber: number;
  index: number;
  globalIndex: number;
}

export interface SearchBarProps {
  pages: ParsedPage[];
  currentPage: number;
  onJumpToPage: (page: number) => void;
  onQueryChange?: (query: string) => void;
  onMatchChange?: (match: SearchMatch | null) => void;
  fontFamily?: string;
  fontSize?: number;
  accentColor?: string;
  textColor?: string;
  backgroundColor?: string;
}

function buildMatches(pages: ParsedPage[], query: string): SearchMatch[] {
  const normalized = query.trim();
  if (normalized.length < 2) {
    return [];
  }

  const lowerQuery = normalized.toLowerCase();
  const matches: SearchMatch[] = [];
  let globalIndex = 0;

  for (const page of pages) {
    const lowerText = page.text.toLowerCase();
    let fromIndex = 0;

    while (fromIndex < lowerText.length) {
      const foundAt = lowerText.indexOf(lowerQuery, fromIndex);
      if (foundAt === -1) {
        break;
      }
      matches.push({
        pageNumber: page.pageNumber,
        index: foundAt,
        globalIndex,
      });
      globalIndex += 1;
      fromIndex = foundAt + lowerQuery.length;
    }
  }

  return matches;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  pages,
  currentPage,
  onJumpToPage,
  onQueryChange,
  onMatchChange,
  fontFamily = 'System',
  fontSize = 14,
  accentColor,
  textColor,
  backgroundColor,
}) => {
  const { theme } = useTheme();
  const resolvedAccentColor = accentColor ?? theme.colors.primary;
  const resolvedTextColor = textColor ?? theme.colors.text;
  const resolvedBackgroundColor = backgroundColor ?? theme.colors.surface;

  const [query, setQuery] = useState('');
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);

  const matches = useMemo(() => buildMatches(pages, query), [pages, query]);

  const activeMatch = matches.length > 0 ? matches[activeMatchIndex] ?? matches[0] : null;

  const updateQuery = useCallback(
    (value: string) => {
      setQuery(value);
      setActiveMatchIndex(0);
      onQueryChange?.(value);
      const nextMatches = buildMatches(pages, value);
      onMatchChange?.(nextMatches[0] ?? null);
    },
    [onQueryChange, onMatchChange, pages]
  );

  const goToMatch = useCallback(
    (direction: 1 | -1) => {
      if (matches.length === 0) {
        return;
      }

      const nextIndex =
        direction === 1
          ? (activeMatchIndex + 1) % matches.length
          : (activeMatchIndex - 1 + matches.length) % matches.length;

      const match = matches[nextIndex];
      setActiveMatchIndex(nextIndex);
      onJumpToPage(match.pageNumber);
      onMatchChange?.(match);
    },
    [activeMatchIndex, matches, onJumpToPage, onMatchChange]
  );

  const fontStyle = getReaderFontStyle(fontFamily, fontSize, 1.4, resolvedTextColor);

  if (!expanded) {
    return (
      <TouchableOpacity
        style={[styles.collapsed, { backgroundColor: resolvedBackgroundColor }]}
        onPress={() => setExpanded(true)}
        accessibilityRole="button"
        accessibilityLabel="Open in-document search"
      >
        <Ionicons name="search" size={20} color={resolvedAccentColor} />
        <ThemedText variant="label" color="secondary" style={fontStyle}>
          Search in document
        </ThemedText>
      </TouchableOpacity>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: resolvedBackgroundColor, borderColor: `${resolvedAccentColor}33` },
      ]}
    >
      <Ionicons name="search" size={18} color={resolvedAccentColor} />
      <TextInput
        value={query}
        onChangeText={updateQuery}
        placeholder="Search in document…"
        placeholderTextColor={`${resolvedTextColor}88`}
        style={[styles.input, fontStyle]}
        autoFocus
        returnKeyType="search"
        onSubmitEditing={() => {
          if (matches.length > 0) {
            onJumpToPage(matches[activeMatchIndex]?.pageNumber ?? currentPage);
          }
        }}
        accessibilityLabel="Search in document"
      />
      <ThemedText variant="caption" color="muted" style={fontStyle}>
        {matches.length > 0 ? `${activeMatchIndex + 1}/${matches.length}` : '0'}
      </ThemedText>
      <TouchableOpacity
        onPress={() => goToMatch(-1)}
        disabled={matches.length === 0}
        accessibilityLabel="Previous match"
        style={styles.iconButton}
      >
        <Ionicons
          name="chevron-up"
          size={20}
          color={matches.length === 0 ? `${resolvedTextColor}44` : resolvedAccentColor}
        />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => goToMatch(1)}
        disabled={matches.length === 0}
        accessibilityLabel="Next match"
        style={styles.iconButton}
      >
        <Ionicons
          name="chevron-down"
          size={20}
          color={matches.length === 0 ? `${resolvedTextColor}44` : resolvedAccentColor}
        />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => {
          setExpanded(false);
          setQuery('');
          setActiveMatchIndex(0);
          onQueryChange?.('');
          onMatchChange?.(null);
          Keyboard.dismiss();
        }}
        accessibilityLabel="Close search"
        style={styles.iconButton}
      >
        <Ionicons name="close" size={20} color={resolvedTextColor} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  collapsed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginHorizontal: 12,
    marginTop: 8,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 12,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    paddingVertical: 4,
    minWidth: 80,
  },
  iconButton: {
    padding: 4,
  },
});

export default SearchBar;
