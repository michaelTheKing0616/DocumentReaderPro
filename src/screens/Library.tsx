import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
  TextInput,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { RootState } from '../redux/store';
import { Document } from '../types';
import { Folder, Bookmark, DocumentSearchResult } from '../services/storage/types';
import DataService from '../services/storage/DataService';
import DocumentScannerService from '../services/document/DocumentScannerService';
import LibraryService from '../services/document/LibraryService';
import FormatConverterService from '../services/document/FormatConverterService';
import ThumbnailService from '../services/document/ThumbnailService';
import { Button } from '../components/common/Button';
import { Screen } from '../components/ui/Screen';
import { Text } from '../components/ui/Text';
import { SearchField } from '../components/ui/SearchField';
import { Chip } from '../components/ui/Chip';
import { EmptyState } from '../components/ui/EmptyState';
import { Card } from '../components/ui/Card';
import { useTheme } from '../theme/useTheme';
import { logger } from '../services/logger/Logger';
import { useTranslation } from '../i18n';

export const LibraryScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const gamification = useSelector((state: RootState) => state.gamification);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<DocumentSearchResult[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [folderModalVisible, setFolderModalVisible] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [thumbnailMap, setThumbnailMap] = useState<Record<string, string>>({});

  const loadLibrary = useCallback(async () => {
    try {
      const [docs, folderList, bookmarkList] = await Promise.all([
        DataService.getUserDocuments(),
        LibraryService.getFolders(),
        LibraryService.getBookmarks(),
      ]);
      setDocuments(docs);
      setFolders(folderList);
      setBookmarks(bookmarkList);

      const thumbs: Record<string, string> = {};
      await Promise.all(
        docs.map(async (doc) => {
          const thumb = await ThumbnailService.ensureDocumentThumbnail(
            doc.id,
            doc.filePath,
            doc.format
          );
          if (thumb) {
            thumbs[doc.id] = thumb;
          }
        })
      );
      setThumbnailMap(thumbs);
    } catch (error) {
      logger.error('Error loading library', {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }, []);

  useEffect(() => {
    void loadLibrary();
    void autoScanDevice();
  }, [loadLibrary]);

  const autoScanDevice = async () => {
    setScanning(true);
    try {
      const scannedDocs = await DocumentScannerService.scanDeviceForDocuments();
      if (scannedDocs.length > 0) {
        const savedDocs = await DocumentScannerService.autoSaveScannedDocuments(scannedDocs);
        if (savedDocs.length > 0) {
          await loadLibrary();
        }
      }
    } catch (error) {
      logger.debug('Auto scan skipped', {
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setScanning(false);
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const results = await DataService.searchDocuments(query.trim());
    setSearchResults(results);
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      return;
    }
    await LibraryService.createFolder(newFolderName.trim(), selectedFolderId ?? undefined);
    setNewFolderName('');
    setFolderModalVisible(false);
    await loadLibrary();
  };

  const handleUpload = async () => {
    setLoading(true);
    try {
      const document = await DocumentScannerService.uploadDocument();
      if (document) {
        Alert.alert(t('common.success'), t('library.uploadSuccess', { title: document.title }));
        await loadLibrary();
      }
    } catch (error) {
      Alert.alert(t('common.error'), t('library.uploadError'));
    } finally {
      setLoading(false);
    }
  };

  const handleConvertToPdf = async (document: Document) => {
    if (document.format === 'pdf') {
      return;
    }
    try {
      const pdfPath = await FormatConverterService.convert(
        document.filePath,
        document.format,
        'pdf'
      );
      Alert.alert(t('library.converted'), t('library.convertedPath', { path: pdfPath }));
    } catch (error) {
      Alert.alert(
        t('library.conversionFailed'),
        error instanceof Error ? error.message : t('library.tryAgain')
      );
    }
  };

  const handleOpenDocument = (document: Document) => {
    navigation.navigate('Reader', { document });
  };

  const handleOpenBookmark = async (bookmark: Bookmark) => {
    const docs = await DataService.getUserDocuments();
    const doc = docs.find((d) => d.id === bookmark.documentId);
    if (doc) {
      navigation.navigate('Reader', { document: doc, initialPage: bookmark.page });
    }
  };

  const filteredDocuments =
    selectedFolderId == null
      ? documents
      : documents.filter((doc) => {
          const folder = folders.find((f) => f.id === selectedFolderId);
          return folder?.documentIds?.includes(doc.id);
        });

  const displayDocuments =
    searchQuery.trim().length >= 2
      ? filteredDocuments.filter((doc) =>
          searchResults.some((result) => result.documentId === doc.id)
        )
      : filteredDocuments;

  const renderDocument = ({ item }: { item: Document }) => {
    const thumbnailUri = thumbnailMap[item.id] ?? item.thumbnailPath;

    return (
      <TouchableOpacity
        style={[styles.documentItem, { borderBottomColor: theme.colors.borderSubtle }]}
        onPress={() => handleOpenDocument(item)}
        onLongPress={() => handleMoveToFolder(item)}
        delayLongPress={400}
      >
        {thumbnailUri ? (
          <Image source={{ uri: thumbnailUri }} style={styles.thumbnail} accessibilityIgnoresInvertColors />
        ) : (
          <View style={[styles.documentIcon, { backgroundColor: theme.colors.primary }]}>
            <Text variant="caption" color="inverse">
              {item.format.toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.documentInfo}>
          <Text variant="body" numberOfLines={1}>
            {item.title}
          </Text>
          <Text variant="caption" color="muted">
            {new Date(item.uploadDate).toLocaleDateString()}
            {item.progress != null
              ? ` • ${t('library.percentRead', { percent: Math.round(item.progress) })}`
              : ''}
          </Text>
          {searchQuery.length >= 2 && (
            <Text variant="caption" color="muted" numberOfLines={1} style={styles.snippet}>
              {searchResults.find((r) => r.documentId === item.id)?.snippet}
            </Text>
          )}
        </View>
        {item.format !== 'pdf' && (
          <TouchableOpacity
            style={[styles.convertButton, { borderColor: theme.colors.primary }]}
            onPress={() => void handleConvertToPdf(item)}
          >
            <Text variant="caption" color="accent">
              PDF
            </Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Screen padded={false} testID="library-screen">
      <View style={[styles.header, { borderBottomColor: theme.colors.borderSubtle, paddingHorizontal: theme.spacing.lg }]}>
        <Text variant="title">{t('library.title')}</Text>
        {scanning && <ActivityIndicator size="small" color={theme.colors.primary} />}
      </View>

      <Card
        style={{ marginHorizontal: theme.spacing.lg, marginTop: theme.spacing.md, marginBottom: theme.spacing.sm }}
        muted
      >
        <Text variant="label" color="muted" style={{ marginBottom: theme.spacing.sm }}>
          {t('dashboard.progress')}
        </Text>
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text variant="title" color="accent">
              {gamification.points}
            </Text>
            <Text variant="caption" color="muted">
              {t('dashboard.points')}
            </Text>
          </View>
          <View style={styles.statBox}>
            <Text variant="title" color="accent">
              {gamification.streaks.current}
            </Text>
            <Text variant="caption" color="muted">
              {t('dashboard.streak')}
            </Text>
          </View>
          <View style={styles.statBox}>
            <Text variant="title" color="accent">
              {gamification.level}
            </Text>
            <Text variant="caption" color="muted">
              {t('dashboard.level')}
            </Text>
          </View>
        </View>
      </Card>

      <View style={[styles.searchRow, { paddingHorizontal: theme.spacing.lg, gap: theme.spacing.sm }]}>
        <SearchField
          value={searchQuery}
          onChangeText={(text) => void handleSearch(text)}
          placeholder={t('library.searchPlaceholder')}
          containerStyle={styles.searchField}
        />
        <Chip label={t('library.addFolder')} onPress={() => setFolderModalVisible(true)} />
      </View>

      {folders.length > 0 && (
        <FlatList
          horizontal
          data={[{ id: '__all__', name: t('common.all') } as Folder, ...folders]}
          keyExtractor={(item) => item.id}
          style={[styles.folderList, { paddingHorizontal: theme.spacing.lg }]}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <Chip
              label={item.name}
              selected={
                item.id === '__all__' ? selectedFolderId == null : selectedFolderId === item.id
              }
              onPress={() => setSelectedFolderId(item.id === '__all__' ? null : item.id)}
              style={{ marginRight: theme.spacing.sm }}
            />
          )}
        />
      )}

      {bookmarks.length > 0 && (
        <View style={[styles.bookmarksSection, { paddingHorizontal: theme.spacing.lg }]}>
          <Text variant="label" color="muted">
            {t('library.bookmarks')}
          </Text>
          <FlatList
            horizontal
            data={bookmarks.slice(0, 8)}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <Chip
                label={item.label ?? `p.${item.page}`}
                onPress={() => void handleOpenBookmark(item)}
                style={{ marginRight: theme.spacing.sm, marginTop: theme.spacing.sm }}
              />
            )}
          />
        </View>
      )}

      <View style={[styles.uploadSection, { padding: theme.spacing.lg, borderBottomColor: theme.colors.borderSubtle }]}>
        <Button title={t('library.scanDocument')} onPress={() => navigation.navigate('TrueScan')} fullWidth />
        <Button
          title={t('library.uploadDocument')}
          onPress={() => void handleUpload()}
          loading={loading}
          variant="outline"
          fullWidth
          style={{ marginTop: theme.spacing.sm }}
        />
        <Button
          title={t('library.batchUpload')}
          onPress={() => void handleBatchUpload()}
          loading={loading}
          variant="outline"
          fullWidth
          style={{ marginTop: theme.spacing.sm }}
        />
      </View>

      <FlatList
        data={displayDocuments}
        renderItem={renderDocument}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await loadLibrary();
              setRefreshing(false);
            }}
          />
        }
        ListEmptyComponent={
          <EmptyState
            lottie="empty"
            title={t('library.emptyTitle')}
            description={t('library.emptyDescription')}
          />
        }
      />

      <Modal visible={folderModalVisible} transparent animationType="slide">
        <View style={[styles.modalOverlay, { backgroundColor: theme.colors.overlay }]}>
          <Card style={styles.modalContent}>
            <Text variant="title" style={{ marginBottom: theme.spacing.md }}>
              {t('library.newFolder')}
            </Text>
            <TextInput
              style={[
                styles.modalInput,
                {
                  borderColor: theme.colors.border,
                  borderRadius: theme.radius.md,
                  color: theme.colors.text,
                },
              ]}
              value={newFolderName}
              onChangeText={setNewFolderName}
              placeholder={t('library.folderNamePlaceholder')}
              placeholderTextColor={theme.colors.textMuted}
            />
            <View style={styles.modalActions}>
              <Button title={t('common.cancel')} variant="outline" onPress={() => setFolderModalVisible(false)} />
              <Button title={t('common.create')} onPress={() => void handleCreateFolder()} />
            </View>
          </Card>
        </View>
      </Modal>
    </Screen>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    alignItems: 'center',
  },
  searchField: {
    flex: 1,
  },
  folderList: {
    maxHeight: 48,
    marginBottom: 8,
  },
  bookmarksSection: {
    marginBottom: 8,
  },
  uploadSection: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  documentItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  thumbnail: {
    width: 48,
    height: 48,
    marginRight: 12,
  },
  documentIcon: {
    width: 48,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  documentInfo: {
    flex: 1,
    gap: 4,
  },
  snippet: {
    fontStyle: 'italic',
    marginTop: 4,
  },
  convertButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
  },
  modalInput: {
    borderWidth: 1,
    padding: 12,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  statBox: { alignItems: 'center' },
});
