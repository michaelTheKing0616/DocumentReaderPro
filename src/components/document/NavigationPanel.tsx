import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TocEntry } from '../../services/document/types';
import { useTheme } from '../../theme/useTheme';

export interface NavigationPanelProps {
  visible: boolean;
  onClose: () => void;
  toc?: TocEntry[];
  currentPage: number;
  pageCount: number;
  onJumpToPage: (page: number) => void;
  onJumpToToc?: (entry: TocEntry) => void;
}

export const NavigationPanel: React.FC<NavigationPanelProps> = ({
  visible,
  onClose,
  toc = [],
  currentPage,
  pageCount,
  onJumpToPage,
  onJumpToToc,
}) => {
  const { theme } = useTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          flex: 1,
          backgroundColor: theme.colors.overlay,
          justifyContent: 'flex-end',
        },
        panel: {
          backgroundColor: theme.colors.surface,
          borderTopLeftRadius: theme.radius.lg,
          borderTopRightRadius: theme.radius.lg,
          maxHeight: '75%',
          paddingBottom: theme.spacing['2xl'],
        },
        header: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: theme.spacing.xl,
          paddingVertical: theme.spacing.lg,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.colors.borderSubtle,
        },
        title: {
          ...theme.typography.title,
          fontSize: 18,
          color: theme.colors.text,
        },
        closeButton: {
          padding: theme.spacing.xs,
        },
        content: {
          paddingHorizontal: theme.spacing.lg,
        },
        section: {
          marginTop: theme.spacing.lg,
          marginBottom: theme.spacing.sm,
        },
        sectionTitle: {
          ...theme.typography.caption,
          fontWeight: '600',
          color: theme.colors.textMuted,
          marginBottom: theme.spacing.sm,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        },
        tocItem: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: theme.spacing.md,
          paddingRight: theme.spacing.sm,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.colors.borderSubtle,
        },
        tocItemActive: {
          backgroundColor: theme.colors.surfaceMuted,
          borderRadius: theme.radius.md,
        },
        tocText: {
          flex: 1,
          fontSize: 15,
          color: theme.colors.text,
        },
        tocTextActive: {
          color: theme.colors.primary,
          fontWeight: '600',
        },
        pageBadge: {
          fontSize: 12,
          color: theme.colors.textMuted,
          marginLeft: theme.spacing.sm,
        },
        pageGrid: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          marginHorizontal: -4,
        },
        pageChip: {
          minWidth: 44,
          height: 36,
          paddingHorizontal: theme.spacing.md,
          borderRadius: theme.radius.md,
          backgroundColor: theme.colors.surfaceMuted,
          alignItems: 'center',
          justifyContent: 'center',
          margin: 4,
        },
        pageChipActive: {
          backgroundColor: theme.colors.primary,
        },
        pageChipText: {
          fontSize: 14,
          color: theme.colors.textSecondary,
          fontWeight: '500',
        },
        pageChipTextActive: {
          color: theme.colors.textInverse,
        },
      }),
    [theme]
  );

  const handleTocPress = (entry: TocEntry) => {
    if (entry.page) {
      onJumpToPage(entry.page);
    }
    onJumpToToc?.(entry);
    onClose();
  };

  const handlePagePress = (page: number) => {
    onJumpToPage(page);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.panel}>
          <View style={styles.header}>
            <Text style={styles.title}>Navigation</Text>
            <TouchableOpacity
              onPress={onClose}
              accessibilityLabel="Close navigation"
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            {toc.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Table of Contents</Text>
                {toc.map((entry, index) => (
                  <TouchableOpacity
                    key={`${entry.title}-${index}`}
                    style={[
                      styles.tocItem,
                      { paddingLeft: theme.spacing.lg + (entry.level - 1) * 12 },
                      entry.page === currentPage && styles.tocItemActive,
                    ]}
                    onPress={() => handleTocPress(entry)}
                  >
                    <Text
                      style={[
                        styles.tocText,
                        entry.page === currentPage && styles.tocTextActive,
                      ]}
                      numberOfLines={2}
                    >
                      {entry.title}
                    </Text>
                    {entry.page !== undefined && (
                      <Text style={styles.pageBadge}>p.{entry.page}</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Pages ({currentPage} / {pageCount})
              </Text>
              <View style={styles.pageGrid}>
                {Array.from({ length: pageCount }, (_, index) => {
                  const page = index + 1;
                  const isActive = page === currentPage;
                  return (
                    <TouchableOpacity
                      key={page}
                      style={[styles.pageChip, isActive && styles.pageChipActive]}
                      onPress={() => handlePagePress(page)}
                    >
                      <Text style={[styles.pageChipText, isActive && styles.pageChipTextActive]}>
                        {page}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

export default NavigationPanel;
