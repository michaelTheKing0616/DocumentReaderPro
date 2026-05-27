import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { RootState } from '../redux/store';
import { Document, Quiz } from '../types';
import { ReaderCanvas } from '../components/document/ReaderCanvas';
import { Annotator } from '../components/document/Annotator';
import {
  ReadingModeController,
  ReadingMode,
} from '../components/document/ReadingModeController';
import { TTSSync } from '../components/assistive/TTSSync';
import { EyeTracker } from '../components/assistive/EyeTracker';
import { AROverlay } from '../components/assistive/AROverlay';
import { ARDefinitionOverlay } from '../components/assistive/ARDefinitionOverlay';
import { ComprehensionMetricDisplay } from '../components/assistive/ComprehensionMetricDisplay';
import { useEyeTracking } from '../hooks/useEyeTracking';
import { useAROverlays } from '../hooks/useAROverlays';
import { useComprehensionMetrics } from '../hooks/useComprehensionMetrics';
import { useGamification } from '../hooks/useGamification';
import { useBrightnessModulation } from '../hooks/useBrightnessModulation';
import { useVoiceCommands } from '../hooks/useVoiceCommands';
import TTService from '../services/tts/TTService';
import AIQuizService from '../services/ai/AIQuizService';
import DataService from '../services/storage/DataService';
import DocumentLoaderService from '../services/document/DocumentLoaderService';
import InterventionEngine from '../services/intervention/InterventionEngine';
import LibraryService from '../services/document/LibraryService';
import AnnotationExportService from '../services/document/AnnotationExportService';
import { shareFile, printFile } from '../utils/shareFile';
import { MultisensoryWord } from '../components/assistive/MultisensoryWord';
import { UXPersonalizer } from '../services/utils/UXPersonalizer';
import { IconButton } from '../components/ui/IconButton';
import { Text } from '../components/ui/Text';
import { Card } from '../components/ui/Card';
import { Screen } from '../components/ui/Screen';
import { PageTransition } from '../components/ui/PageTransition';
import { Button } from '../components/common/Button';
import { useTheme } from '../theme/useTheme';
import * as Haptics from 'expo-haptics';
import { useTranslation } from '../i18n';
import RealtimeService from '../services/collaboration/RealtimeService';
import StripeService from '../services/billing/StripeService';

const PDF_PAGE_WIDTH = 612;
const PDF_PAGE_HEIGHT = 792;

export const ReaderScreen: React.FC = () => {
  const { t } = useTranslation();
  const route = useRoute();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const document = (route.params as { document: Document })?.document;
  const user = useSelector((state: RootState) => state.user.profile);
  const hardwareType = useSelector((state: RootState) => state.settings.hardwareType);
  const scrollMode = useSelector((state: RootState) => state.settings.scrollMode);
  const preferences = user?.preferences ?? {
    fontSize: 16,
    fontFamily: 'System',
    lineSpacing: 1.5,
    theme: 'light',
    ttsEnabled: false,
    ttsSpeed: 150,
    eyeTrackingEnabled: false,
    arOverlaysEnabled: false,
    brightnessAutoAdjust: false,
  };

  const [currentPage, setCurrentPage] = useState(1);
  const [showToolbar, setShowToolbar] = useState(true);
  const [showQuiz, setShowQuiz] = useState(false);
  const [currentQuiz, setCurrentQuiz] = useState<Quiz | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<number[]>([]);
  const [showComprehension, setShowComprehension] = useState(false);
  const [readingMode, setReadingMode] = useState<ReadingMode>('normal');
  const [pageText, setPageText] = useState('');
  const [annotateEnabled, setAnnotateEnabled] = useState(false);
  const [multisensoryEnabled, setMultisensoryEnabled] = useState(false);
  const [highlightWordIndex, setHighlightWordIndex] = useState(-1);
  const [showWordLookup, setShowWordLookup] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exporting, setExporting] = useState(false);

  const annotationPageSize = useMemo(() => {
    if (document?.format === 'pdf') {
      return { width: PDF_PAGE_WIDTH, height: PDF_PAGE_HEIGHT };
    }
    return null;
  }, [document?.format]);

  const { metrics, startTracking, stopTracking } = useEyeTracking({
    enabled: preferences.eyeTrackingEnabled,
    hardwareType,
    onMetricsUpdate: (updatedMetrics) => {
      if (preferences.brightnessAutoAdjust) {
        adjustBrightness(updatedMetrics);
      }
      const interventions = InterventionEngine.evaluateReadingSession(
        updatedMetrics,
        user ?? null,
        updatedMetrics.timeOnPage
      );
      const highPriority = interventions.find((item) => item.priority === 'high');
      if (highPriority) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert(t('reader.readingAssist'), highPriority.message);
      }
    },
  });

  const { overlays, updateGaze, createDefinition } = useAROverlays(preferences.arOverlaysEnabled);
  const { currentMetric, predictComprehension } = useComprehensionMetrics();
  const { awardPagePoints, checkBadges } = useGamification();
  const { adjustBrightness, recordPageComplete } = useBrightnessModulation(preferences.brightnessAutoAdjust);

  const voiceCommandsEnabled =
    (user?.preferences as { voiceCommands?: boolean } | undefined)?.voiceCommands !== false;

  useVoiceCommands(voiceCommandsEnabled, (command) => {
    switch (command) {
      case 'pause-tts':
        TTService.stop();
        break;
      case 'next-page':
        setCurrentPage((page) => page + 1);
        break;
      case 'previous-page':
        setCurrentPage((page) => Math.max(1, page - 1));
        break;
      case 'focus-mode':
        setReadingMode('focus');
        setShowToolbar(false);
        break;
    }
  });

  const loadPageText = useCallback(async () => {
    if (!document) {
      setPageText('');
      return;
    }
    try {
      const parsed = await DocumentLoaderService.load(document.filePath, document.format, {
        documentId: document.id,
        title: document.title,
      });
      const text =
        parsed.pages?.find((page) => page.pageNumber === currentPage)?.text ??
        parsed.text ??
        '';
      setPageText(text);
    } catch {
      setPageText('');
    }
  }, [document, currentPage]);

  useEffect(() => {
    if (user) {
      setReadingMode(UXPersonalizer.suggestReadingMode(user));
    }
  }, [user?.id]);

  useEffect(() => {
    void loadPageText();
  }, [loadPageText]);

  const collabSyncRef = React.useRef(false);

  useEffect(() => {
    if (!document || !StripeService.canAccess('realtime_collab')) {
      return undefined;
    }
    const session = DataService.getCurrentUser();
    if (!session || session.isLocalOnly || !RealtimeService.isAvailable()) {
      return undefined;
    }

    RealtimeService.subscribe(session.id, document.id, user?.name ?? user?.email);
    const off = RealtimeService.on('reading_session', (message) => {
      if (message.event !== 'reading_update') {
        return;
      }
      const senderId = message.payload.userId as string | undefined;
      if (senderId && senderId === session.id) {
        return;
      }
      const page = Number(message.payload.page);
      if (Number.isFinite(page) && page >= 1) {
        collabSyncRef.current = true;
        setCurrentPage(page);
      }
    });

    return () => {
      off();
      RealtimeService.unsubscribe();
    };
  }, [document?.id, user?.name, user?.email]);

  useEffect(() => {
    if (!document || !StripeService.canAccess('realtime_collab')) {
      return;
    }
    if (collabSyncRef.current) {
      collabSyncRef.current = false;
      return;
    }
    const session = DataService.getCurrentUser();
    if (!session || session.isLocalOnly || !RealtimeService.isSubscribed()) {
      return;
    }
    void RealtimeService.broadcast('reading_session', 'reading_update', {
      page: currentPage,
      documentId: document.id,
      userId: session.id,
    });
  }, [currentPage, document?.id]);

  useEffect(() => {
    if (metrics && preferences.arOverlaysEnabled) {
      const lastGaze = metrics.fixations[metrics.fixations.length - 1];
      if (lastGaze) {
        updateGaze({ x: lastGaze.x, y: lastGaze.y, timestamp: Date.now() });
      }
    }
  }, [metrics, preferences.arOverlaysEnabled, updateGaze]);

  const handlePageComplete = useCallback(async () => {
    if (!document) {
      return;
    }

    awardPagePoints(1);

    if (pageText.trim()) {
      const quiz = await AIQuizService.generateQuiz(pageText.trim(), currentPage, document.id);
      if (quiz.questions.length > 0) {
        setCurrentQuiz(quiz);
        setShowQuiz(true);
        setQuizAnswers([]);
      } else {
        Alert.alert(t('reader.pageComplete'), t('reader.quizNotEnoughText'));
      }
    } else {
      Alert.alert(t('reader.pageComplete'), t('reader.quizNoText'));
    }

    if (metrics) {
      recordPageComplete(metrics.timeOnPage);
    }

    if (metrics) {
      await predictComprehension(metrics);
      setShowComprehension(true);
    }

    checkBadges({
      pagesRead: currentPage,
      quizzesCompleted: 0,
      regressions: metrics?.regressions.length ?? 0,
      streaks: 0,
    });

    await DataService.saveDocument({
      ...document,
      lastRead: new Date(),
      progress: Math.min(100, ((currentPage / (document.pageCount ?? currentPage)) * 100)),
    });
  }, [
    document,
    currentPage,
    metrics,
    pageText,
    awardPagePoints,
    checkBadges,
    predictComprehension,
    recordPageComplete,
    t,
  ]);

  const handleQuizSubmit = useCallback(() => {
    if (!currentQuiz) {
      return;
    }

    const score = AIQuizService.scoreQuiz(currentQuiz, quizAnswers);
    Alert.alert(t('reader.quizComplete'), t('reader.quizScore', { score }));
    setShowQuiz(false);

    if (metrics && document) {
      void DataService.saveReadingMetrics({
        documentId: document.id,
        pageNumber: currentPage,
        eyeMetrics: metrics,
        readingSpeed: 200,
        comprehensionScore: score,
        timeSpent: metrics.timeOnPage,
        timestamp: new Date(),
      });
    }
  }, [currentQuiz, quizAnswers, metrics, document, currentPage]);

  useEffect(() => {
    if (user) {
      setReadingMode(UXPersonalizer.suggestReadingMode(user));
    }
  }, [user]);

  useEffect(() => {
    if (preferences.eyeTrackingEnabled) {
      startTracking();
    }
    return () => {
      stopTracking();
    };
  }, [preferences.eyeTrackingEnabled, startTracking, stopTracking]);

  const handleAddBookmark = async () => {
    if (!document) {
      return;
    }
    await LibraryService.addBookmark(document.id, currentPage, `Page ${currentPage}`);
    Alert.alert(t('reader.bookmarkSaved'), t('reader.bookmarkSavedMessage', { page: currentPage }));
  };

  const handleExportAnnotations = async (format: 'pdf' | 'csv', action: 'share' | 'print' = 'share') => {
    if (!document) {
      return;
    }
    setExporting(true);
    try {
      const stored = await DataService.getAnnotations(document.id);
      const annotations = stored.map((a) => ({
        id: a.id,
        type: a.type,
        page: a.page,
        x: a.x,
        y: a.y,
        width: a.width,
        height: a.height,
        color: a.color,
        text: a.text,
        timestamp: new Date(a.timestamp),
      }));
      const uri = await AnnotationExportService.export({
        document,
        annotations,
        format,
      });
      if (action === 'print') {
        await printFile(uri, `${document.title} annotations`);
      } else {
        await shareFile({
          uri,
          title: `${document.title} annotations`,
          mimeType: format === 'csv' ? 'text/csv' : 'application/pdf',
        });
      }
      setShowExportMenu(false);
    } catch (error) {
      Alert.alert(
        t('reader.exportFailed'),
        error instanceof Error ? error.message : t('reader.exportFailedMessage')
      );
    } finally {
      setExporting(false);
    }
  };

  const handleShareDocument = async () => {
    if (!document?.filePath) {
      Alert.alert(t('reader.shareUnavailable'), t('reader.shareUnavailableMessage'));
      return;
    }
    try {
      await shareFile({
        uri: document.filePath,
        title: document.title,
        mimeType: document.format === 'pdf' ? 'application/pdf' : 'application/octet-stream',
      });
    } catch (error) {
      Alert.alert(t('reader.shareFailed'), error instanceof Error ? error.message : t('library.tryAgain'));
    }
  };

  const cycleReadingMode = () => {
    setReadingMode((mode) => {
      if (mode === 'normal') {
        return 'focus';
      }
      if (mode === 'focus') {
        return 'guided';
      }
      return 'normal';
    });
  };

  const readingModeIcon = useMemo((): React.ComponentProps<typeof Ionicons>['name'] => {
    if (readingMode === 'focus') {
      return 'eye-outline';
    }
    if (readingMode === 'guided') {
      return 'book-outline';
    }
    return 'document-text-outline';
  }, [readingMode]);

  const toolbarVisible = showToolbar && readingMode !== 'focus';
  const ttsText = useMemo(() => pageText, [pageText]);

  if (!document) {
    return (
      <Screen>
        <View style={styles.emptyDocument}>
          <Text variant="body" color="secondary">
            No document selected
          </Text>
        </View>
      </Screen>
    );
  }

  const renderPageContent = () => {
    if (preferences.ttsEnabled && ttsText.length > 0) {
      return (
        <TTSSync
          text={ttsText}
          preferences={preferences}
          onWordHighlight={setHighlightWordIndex}
        />
      );
    }
    if (multisensoryEnabled && pageText.length > 0) {
      return (
        <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingTop: 56 }}>
          {pageText.split(/\s+/).map((word, index) => (
            <MultisensoryWord
              key={`${word}-${index}`}
              word={word}
              index={index}
              highlighted={highlightWordIndex === index}
              preferences={preferences}
              fontSize={preferences.fontSize}
            />
          ))}
        </ScrollView>
      );
    }
    return (
      <ReaderCanvas
        document={document}
        onPageChange={setCurrentPage}
        fontSize={preferences.fontSize}
        fontFamily={preferences.fontFamily}
        lineSpacing={preferences.lineSpacing}
        theme={preferences.theme}
        initialPage={currentPage}
        scrollMode={scrollMode}
      />
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      <ReadingModeController
        mode={readingMode}
        lineSpacing={preferences.lineSpacing}
        fontSize={preferences.fontSize}
        onGuidedLineAdvance={() => setCurrentPage((page) => page + 1)}
      >
        <PageTransition pageKey={currentPage}>
          <Annotator
            documentId={document.id}
            page={currentPage}
            enabled={annotateEnabled}
            pageLayoutWidth={annotationPageSize?.width}
            pageLayoutHeight={annotationPageSize?.height}
          >
            {renderPageContent()}
          </Annotator>
        </PageTransition>
      </ReadingModeController>

      {preferences.eyeTrackingEnabled && (
        <EyeTracker enabled={preferences.eyeTrackingEnabled} showVisualization={false} />
      )}

      {preferences.arOverlaysEnabled &&
        overlays.map((overlay) => <AROverlay key={overlay.id} overlay={overlay} />)}

      {toolbarVisible && (
        <View
          style={[
            styles.toolbar,
            {
              backgroundColor: theme.colors.surfaceElevated,
              borderBottomColor: theme.colors.borderSubtle,
              padding: theme.spacing.md,
            },
          ]}
        >
          <IconButton
            icon="arrow-back"
            onPress={() => navigation.goBack()}
            accessibilityLabel="Go back"
            variant="ghost"
            size={20}
          />
          <Text variant="caption" style={{ fontWeight: '600' }}>
            Page {currentPage}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.toolbarActions}>
            <IconButton
              icon={readingModeIcon}
              onPress={cycleReadingMode}
              accessibilityLabel={`Reading mode: ${readingMode}`}
              variant="ghost"
              size={20}
            />
            <IconButton
              icon="bookmark-outline"
              onPress={() => void handleAddBookmark()}
              accessibilityLabel="Add bookmark"
              variant="ghost"
              size={20}
            />
            <IconButton
              icon={multisensoryEnabled ? 'volume-high-outline' : 'hand-left-outline'}
              onPress={() => setMultisensoryEnabled((value) => !value)}
              accessibilityLabel={multisensoryEnabled ? 'Disable multisensory' : 'Enable multisensory'}
              variant={multisensoryEnabled ? 'filled' : 'ghost'}
              size={20}
            />
            <IconButton
              icon={annotateEnabled ? 'checkmark-circle' : 'create-outline'}
              onPress={() => setAnnotateEnabled((value) => !value)}
              accessibilityLabel={annotateEnabled ? 'Disable annotations' : 'Enable annotations'}
              variant={annotateEnabled ? 'filled' : 'ghost'}
              size={20}
            />
            <IconButton
              icon="camera-outline"
              onPress={() => setShowWordLookup(true)}
              accessibilityLabel="Word lookup camera"
              variant="ghost"
              size={20}
            />
            <IconButton
              icon="share-outline"
              onPress={() => setShowExportMenu(true)}
              accessibilityLabel="Export and share"
              variant="ghost"
              size={20}
            />
            <IconButton
              icon="checkmark-done-outline"
              onPress={() => void handlePageComplete()}
              accessibilityLabel="Mark page complete"
              variant="filled"
              size={20}
            />
          </ScrollView>
        </View>
      )}

      {!toolbarVisible && (
        <View style={[styles.fab, { bottom: theme.spacing.xl, right: theme.spacing.xl }]}>
          <IconButton
            icon="settings-outline"
            onPress={() => setShowToolbar(true)}
            accessibilityLabel="Show toolbar"
            variant="filled"
            size={24}
          />
        </View>
      )}

      {showComprehension && currentMetric && (
        <Modal visible={showComprehension} transparent animationType="slide">
          <View style={[styles.modalOverlay, { backgroundColor: theme.colors.overlay }]}>
            <Card style={styles.modalContent}>
              <ComprehensionMetricDisplay metric={currentMetric} showDetails />
              <Button title="Close" variant="outline" onPress={() => setShowComprehension(false)} fullWidth />
            </Card>
          </View>
        </Modal>
      )}

      {showQuiz && currentQuiz && (
        <Modal visible={showQuiz} transparent animationType="slide">
          <View style={[styles.modalOverlay, { backgroundColor: theme.colors.overlay }]}>
            <Card style={styles.modalContent}>
              <Text variant="title" style={{ marginBottom: theme.spacing.lg }}>
                Comprehension Quiz
              </Text>
              <ScrollView>
                {currentQuiz.questions.map((question, qIndex) => (
                  <View key={question.id} style={{ marginBottom: theme.spacing.xl }}>
                    <Text variant="body" style={{ fontWeight: '600', marginBottom: theme.spacing.md }}>
                      {question.question}
                    </Text>
                    {question.options.map((option, oIndex) => (
                      <Button
                        key={oIndex}
                        title={option}
                        variant={quizAnswers[qIndex] === oIndex ? 'primary' : 'outline'}
                        onPress={() => {
                          const newAnswers = [...quizAnswers];
                          newAnswers[qIndex] = oIndex;
                          setQuizAnswers(newAnswers);
                        }}
                        fullWidth
                        style={{ marginBottom: theme.spacing.sm }}
                      />
                    ))}
                  </View>
                ))}
              </ScrollView>
              <Button title="Submit" onPress={handleQuizSubmit} fullWidth />
            </Card>
          </View>
        </Modal>
      )}

      {showExportMenu && (
        <Modal visible={showExportMenu} transparent animationType="fade">
          <View style={[styles.modalOverlay, { backgroundColor: theme.colors.overlay }]}>
            <Card style={styles.modalContent}>
              <Text variant="title" style={{ marginBottom: theme.spacing.lg }}>
                Export & Share
              </Text>
              <Button
                title="Export annotations (PDF)"
                variant="outline"
                disabled={exporting}
                onPress={() => void handleExportAnnotations('pdf', 'share')}
                fullWidth
                style={{ marginBottom: theme.spacing.sm }}
              />
              <Button
                title="Export annotations (CSV)"
                variant="outline"
                disabled={exporting}
                onPress={() => void handleExportAnnotations('csv', 'share')}
                fullWidth
                style={{ marginBottom: theme.spacing.sm }}
              />
              <Button
                title="Print annotations"
                variant="outline"
                disabled={exporting}
                onPress={() => void handleExportAnnotations('pdf', 'print')}
                fullWidth
                style={{ marginBottom: theme.spacing.sm }}
              />
              <Button
                title="Share document"
                variant="outline"
                onPress={() => void handleShareDocument()}
                fullWidth
                style={{ marginBottom: theme.spacing.sm }}
              />
              <Button title="Cancel" variant="outline" onPress={() => setShowExportMenu(false)} fullWidth />
            </Card>
          </View>
        </Modal>
      )}

      <ARDefinitionOverlay
        visible={showWordLookup}
        onClose={() => setShowWordLookup(false)}
        onWordDetected={(word, definition) => {
          createDefinition(word, definition, { x: 80, y: 200 });
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  emptyDocument: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  toolbar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  toolbarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flex: 1,
    justifyContent: 'flex-end',
  },
  fab: { position: 'absolute' },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxHeight: '80%',
  },
});
