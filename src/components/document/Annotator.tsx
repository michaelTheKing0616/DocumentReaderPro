import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TextInput,
  PanResponder,
  GestureResponderEvent,
  LayoutChangeEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Annotation } from '../../types';
import { StoredAnnotation } from '../../services/storage/types';
import DataService from '../../services/storage/DataService';
import { generateIdSync } from '../../utils/id';
import { logger } from '../../services/logger/Logger';
import { useTheme } from '../../theme/useTheme';
import { IconButton } from '../ui/IconButton';
import { Text } from '../ui/Text';
import { denormalizeAnnotation, normalizeAnnotationCoords } from '../../utils/annotationCoords';

export type AnnotationTool = 'highlight' | 'underline' | 'note';

interface AnnotatorProps {
  documentId: string;
  page: number;
  enabled: boolean;
  children?: React.ReactNode;
  /** When set, annotations are stored as fractions of this size (PDF-scaled). */
  pageLayoutWidth?: number;
  pageLayoutHeight?: number;
}

interface DraftAnnotation {
  x: number;
  y: number;
  width: number;
  height: number;
  type: AnnotationTool;
}

export const Annotator: React.FC<AnnotatorProps> = ({
  documentId,
  page,
  enabled,
  children,
  pageLayoutWidth,
  pageLayoutHeight,
}) => {
  const { theme } = useTheme();
  const [annotations, setAnnotations] = useState<StoredAnnotation[]>([]);
  const [activeTool, setActiveTool] = useState<AnnotationTool>('highlight');
  const [draft, setDraft] = useState<DraftAnnotation | null>(null);
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [layoutSize, setLayoutSize] = useState({ width: 0, height: 0 });

  const contentWidth = pageLayoutWidth ?? layoutSize.width;
  const contentHeight = pageLayoutHeight ?? layoutSize.height;

  const loadAnnotations = useCallback(async () => {
    try {
      const items = await DataService.getAnnotations(documentId);
      setAnnotations(items.filter((item) => item.page === page));
    } catch (error) {
      logger.warn('Failed to load annotations', {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }, [documentId, page]);

  useEffect(() => {
    void loadAnnotations();
  }, [loadAnnotations]);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setLayoutSize({ width, height });
  };

  const persistAnnotation = async (annotation: StoredAnnotation) => {
    await DataService.saveAnnotation(annotation);
    setAnnotations((prev) => [...prev, annotation]);
  };

  const handleTouchStart = (event: GestureResponderEvent) => {
    if (!enabled) return;
    const { locationX, locationY } = event.nativeEvent;
    setDraft({ x: locationX, y: locationY, width: 0, height: 0, type: activeTool });
  };

  const handleTouchMove = (event: GestureResponderEvent) => {
    if (!enabled || !draft) return;
    const { locationX, locationY } = event.nativeEvent;
    setDraft({ ...draft, width: locationX - draft.x, height: locationY - draft.y });
  };

  const handleTouchEnd = async () => {
    if (!enabled || !draft) return;
    if (activeTool === 'note') {
      setNoteModalVisible(true);
      return;
    }

    const absW = Math.abs(draft.width);
    const absH = Math.abs(draft.height);
    const rawX = Math.min(draft.x, draft.x + draft.width);
    const rawY = Math.min(draft.y, draft.y + draft.height);

    const coords =
      contentWidth > 0 && contentHeight > 0
        ? normalizeAnnotationCoords(rawX, rawY, absW, absH, contentWidth, contentHeight)
        : { x: rawX, y: rawY, width: absW, height: absH };

    const normalized: StoredAnnotation = {
      id: generateIdSync(),
      documentId,
      page,
      type: draft.type as Annotation['type'],
      x: coords.x,
      y: coords.y,
      width: coords.width,
      height: coords.height,
      color: draft.type === 'highlight' ? theme.colors.warning : theme.colors.primary,
      timestamp: new Date(),
    };

    await persistAnnotation(normalized);
    setDraft(null);
  };

  const saveNote = async () => {
    if (!draft) return;
    const coords =
      contentWidth > 0 && contentHeight > 0
        ? normalizeAnnotationCoords(draft.x, draft.y, 120, 40, contentWidth, contentHeight)
        : { x: draft.x, y: draft.y, width: 120, height: 40 };

    const note: StoredAnnotation = {
      id: generateIdSync(),
      documentId,
      page,
      type: 'note',
      x: coords.x,
      y: coords.y,
      width: coords.width,
      height: coords.height,
      text: noteText,
      color: theme.colors.surfaceMuted,
      timestamp: new Date(),
    };
    await persistAnnotation(note);
    setNoteText('');
    setNoteModalVisible(false);
    setDraft(null);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => enabled,
      onMoveShouldSetPanResponder: () => enabled,
      onPanResponderGrant: handleTouchStart,
      onPanResponderMove: handleTouchMove,
      onPanResponderRelease: () => {
        void handleTouchEnd();
      },
    })
  ).current;

  const displayAnnotations = useMemo(() => {
    if (contentWidth <= 0 || contentHeight <= 0) {
      return annotations;
    }
    return annotations.map((a) => denormalizeAnnotation(a, contentWidth, contentHeight));
  }, [annotations, contentWidth, contentHeight]);

  const overlayRects = useMemo(() => {
    return displayAnnotations
      .filter((a) => a.type === 'highlight' || a.type === 'underline')
      .map((a) => ({
        id: a.id,
        x: a.x,
        y: a.y,
        width: a.width ?? 80,
        height: a.type === 'underline' ? 3 : (a.height ?? 24),
        color: a.type === 'highlight' ? theme.colors.warning : theme.colors.primary,
        opacity: a.type === 'highlight' ? 0.35 : 1,
      }));
  }, [displayAnnotations, theme.colors]);

  const draftRect = draft && draft.type !== 'note'
    ? {
        x: Math.min(draft.x, draft.x + draft.width),
        y: Math.min(draft.y, draft.y + draft.height),
        width: Math.abs(draft.width),
        height: Math.abs(draft.height),
      }
    : null;

  const toolIcons: { tool: AnnotationTool; icon: keyof typeof Ionicons.glyphMap }[] = [
    { tool: 'highlight', icon: 'color-fill-outline' },
    { tool: 'underline', icon: 'remove-outline' },
    { tool: 'note', icon: 'document-text-outline' },
  ];

  return (
    <View style={styles.container} onLayout={onLayout} {...panResponder.panHandlers}>
      {children}

      {(contentWidth > 0 && contentHeight > 0) &&
        overlayRects.map((rect) => (
          <View
            key={rect.id}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: rect.x,
              top: rect.y,
              width: rect.width,
              height: rect.height,
              backgroundColor: rect.color,
              opacity: rect.opacity,
            }}
          />
        ))}

      {draftRect && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: draftRect.x,
            top: draftRect.y,
            width: draftRect.width,
            height: draft?.type === 'underline' ? 3 : draftRect.height,
            backgroundColor: theme.colors.primary,
            opacity: 0.25,
          }}
        />
      )}

      {displayAnnotations
        .filter((a) => a.type === 'note')
        .map((annotation) => (
          <View
            key={annotation.id}
            style={[
              styles.noteBubble,
              {
                left: annotation.x,
                top: annotation.y,
                backgroundColor: theme.colors.surfaceMuted,
                borderColor: theme.colors.warning,
              },
            ]}
          >
            <Text variant="caption" numberOfLines={3}>
              {annotation.text}
            </Text>
          </View>
        ))}

      {enabled && (
        <View
          style={[
            styles.toolbar,
            {
              backgroundColor: theme.colors.surfaceElevated,
              borderColor: theme.colors.borderSubtle,
              ...theme.shadows.md,
            },
          ]}
        >
          {toolIcons.map(({ tool, icon }) => (
            <IconButton
              key={tool}
              icon={icon}
              onPress={() => setActiveTool(tool)}
              accessibilityLabel={tool}
              variant={activeTool === tool ? 'filled' : 'ghost'}
              size={18}
            />
          ))}
        </View>
      )}

      <Modal visible={noteModalVisible} transparent animationType="fade">
        <View style={[styles.modalOverlay, { backgroundColor: theme.colors.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
            <Text variant="title" style={{ marginBottom: theme.spacing.md }}>
              Add note
            </Text>
            <TextInput
              style={[
                styles.noteInput,
                { borderColor: theme.colors.border, color: theme.colors.text },
              ]}
              multiline
              value={noteText}
              onChangeText={setNoteText}
              placeholder="Your note…"
              placeholderTextColor={theme.colors.textMuted}
            />
            <View style={styles.modalActions}>
              <Text onPress={() => setNoteModalVisible(false)}>Cancel</Text>
              <Text
                onPress={() => void saveNote()}
                style={{ color: theme.colors.primary, fontWeight: '600' }}
              >
                Save
              </Text>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  toolbar: {
    position: 'absolute',
    top: 56,
    right: 12,
    borderRadius: 12,
    padding: 4,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 2,
  },
  noteBubble: {
    position: 'absolute',
    maxWidth: 160,
    padding: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    borderRadius: 12,
    padding: 16,
  },
  noteInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
});

export default Annotator;
