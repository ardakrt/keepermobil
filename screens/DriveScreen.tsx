import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  Modal,
  Dimensions,
  Share,
  Linking,
  StatusBar,
  BackHandler,
} from 'react-native';
// WebView kaldırıldı - resimler Image, diğerleri harici tarayıcı ile açılıyor
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { useFocusEffect } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';
import {
  File,
  Upload,
  Folder,
  FileText,
  Image as ImageIcon,
  HardDrive,
  LogOut,
  ChevronLeft,
  Trash2,
  Video,
  Music,
  FileSpreadsheet,
  FileArchive,
} from 'lucide-react-native';
import { useAppTheme } from '../lib/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Avatar from '../components/Avatar';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../lib/supabaseClient';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
import * as WebBrowser from 'expo-web-browser';

import * as Haptics from 'expo-haptics';

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  thumbnailLink?: string;
  webViewLink?: string;
  parents?: string[];
}

interface FolderPath {
  id: string;
  name: string;
}

export default function DriveScreen({ navigation }) {
  const { theme, accent } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [session, setSession] = useState(null);
  const [token, setToken] = useState<string | null>(null);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [currentFolderId, setCurrentFolderId] = useState<string>('root');
  const [folderPath, setFolderPath] = useState<FolderPath[]>([{ id: 'root', name: 'Drive' }]);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<DriveFile | null>(null);
  const [previewFile, setPreviewFile] = useState<DriveFile | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      setSession(sessionData?.session);
    })();

    GoogleSignin.configure({
      webClientId: '961544758987-fk2o1sujm7n3o55s23ku6u57tckfv7ij.apps.googleusercontent.com', 
      scopes: ['https://www.googleapis.com/auth/drive'], // Full access for delete
      offlineAccess: true,
    });
    checkLocalToken();
  }, []);

  const handleLogin = async () => {
    try {
      await GoogleSignin.hasPlayServices();
      await GoogleSignin.signIn();
      const tokens = await GoogleSignin.getTokens();
      
      if (tokens.accessToken) {
        saveToken(tokens.accessToken);
        fetchFiles(tokens.accessToken, 'root');
      }
    } catch (error: any) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        console.log("Kullanıcı iptal etti");
      } else if (error.code === statusCodes.IN_PROGRESS) {
        console.log("Giriş zaten devam ediyor");
      } else {
        console.error("Giriş Hatası:", error);
        Alert.alert("Hata", `Google girişi başarısız: ${error.message}`);
      }
    }
  };

  const saveToken = async (newToken: string) => {
    setToken(newToken);
    await SecureStore.setItemAsync('google_drive_token', newToken);
  };

  const checkLocalToken = async () => {
    setLoading(true);
    const savedToken = await SecureStore.getItemAsync('google_drive_token');
    if (savedToken) {
      setToken(savedToken);
      fetchFiles(savedToken, 'root');
    } else {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await GoogleSignin.signOut();
      await SecureStore.deleteItemAsync('google_drive_token');
      setToken(null);
      setFiles([]);
      setCurrentFolderId('root');
      setFolderPath([{ id: 'root', name: 'Drive' }]);
    } catch (error) {
      console.error(error);
    }
  };

  const refreshToken = async (): Promise<string | null> => {
    try {
      const tokens = await GoogleSignin.getTokens();
      if (tokens.accessToken) {
        await saveToken(tokens.accessToken);
        return tokens.accessToken;
      }
    } catch (error) {
      console.error("Token yenileme hatası:", error);
    }
    return null;
  };

  const fetchFiles = async (accessToken: string, folderId: string) => {
    setLoading(true);
    try {
      // Root için My Drive'daki dosyaları getir
      let query: string;
      if (folderId === 'root') {
        // 'root' in parents - kullanıcının My Drive kök klasörü
        query = "'root' in parents and trashed=false";
      } else {
        query = `'${folderId}' in parents and trashed=false`;
      }
      
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,size,thumbnailLink,webViewLink,parents)&pageSize=100&orderBy=folder,name&spaces=drive`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      
      if (response.status === 401) {
        // Token expired, try to refresh
        const newToken = await refreshToken();
        if (newToken) {
          return fetchFiles(newToken, folderId);
        }
        Alert.alert("Oturum", "Süre doldu, tekrar giriş yapın.");
        handleLogout();
        return;
      }

      const data = await response.json();
      
      if (data.error) {
        console.error('Drive API Error:', data.error);
        Alert.alert("API Hatası", data.error.message || "Bilinmeyen hata");
        return;
      }
      
      if (data.files) {
        // Sort: folders first, then files
        const sorted = data.files.sort((a: DriveFile, b: DriveFile) => {
          const aIsFolder = a.mimeType === 'application/vnd.google-apps.folder';
          const bIsFolder = b.mimeType === 'application/vnd.google-apps.folder';
          if (aIsFolder && !bIsFolder) return -1;
          if (!aIsFolder && bIsFolder) return 1;
          return a.name.localeCompare(b.name);
        });
        setFiles(sorted);
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Hata", "Dosyalar yüklenirken bir hata oluştu.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const openFolder = (folder: DriveFile) => {
    setCurrentFolderId(folder.id);
    setFolderPath(prev => [...prev, { id: folder.id, name: folder.name }]);
    if (token) fetchFiles(token, folder.id);
  };

  const goBack = () => {
    if (folderPath.length > 1) {
      const newPath = folderPath.slice(0, -1);
      const parentFolder = newPath[newPath.length - 1];
      setFolderPath(newPath);
      setCurrentFolderId(parentFolder.id);
      if (token) fetchFiles(token, parentFolder.id);
    }
  };

  // Android geri tuşunu yakala - klasör içindeyken üst klasöre dön
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        // Önizleme açıksa kapat
        if (previewFile) {
          setPreviewFile(null);
          return true;
        }
        // Silme modalı açıksa kapat
        if (deleteModalVisible) {
          setDeleteModalVisible(false);
          return true;
        }
        // Root klasörde değilsek üst klasöre git
        if (folderPath.length > 1) {
          goBack();
          return true; // Varsayılan geri davranışını engelle
        }
        return false; // Varsayılan davranışa izin ver (Defter'e dön)
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [folderPath, previewFile, deleteModalVisible])
  );

  const goToFolder = (index: number) => {
    if (index < folderPath.length - 1) {
      const newPath = folderPath.slice(0, index + 1);
      const targetFolder = newPath[newPath.length - 1];
      setFolderPath(newPath);
      setCurrentFolderId(targetFolder.id);
      if (token) fetchFiles(token, targetFolder.id);
    }
  };

  const deleteFile = (file: DriveFile) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setFileToDelete(file);
    setDeleteModalVisible(true);
  };

  const handleConfirmDelete = async () => {
    if (!fileToDelete) return;
    
    setDeleteModalVisible(false);
    const file = fileToDelete;
    
    try {
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${file.id}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      if (response.status === 204 || response.ok) {
        setFiles(prev => prev.filter(f => f.id !== file.id));
        // Alert.alert("Başarılı", "Dosya silindi."); // Optional: Toast might be better
      } else if (response.status === 401) {
        const newToken = await refreshToken();
        if (newToken) {
          // Retry with new token
          const retryResponse = await fetch(
            `https://www.googleapis.com/drive/v3/files/${file.id}`,
            {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${newToken}` }
            }
          );
          if (retryResponse.status === 204 || retryResponse.ok) {
            setFiles(prev => prev.filter(f => f.id !== file.id));
            // Alert.alert("Başarılı", "Dosya silindi.");
          }
        }
      } else {
        const errorData = await response.json();
        Alert.alert("Hata", errorData.error?.message || "Dosya silinemedi.");
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Hata", "Dosya silinirken bir hata oluştu.");
    } finally {
      setFileToDelete(null);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    if (token) fetchFiles(token, currentFolderId);
  };

  const formatSize = (bytes: string | undefined) => {
    if (!bytes) return '-';
    const b = parseInt(bytes);
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(b) / Math.log(k));
    return parseFloat((b / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType === 'application/vnd.google-apps.folder') {
      return <Folder color="#EAB308" size={24} fill="#EAB308" fillOpacity={0.2} />;
    }
    if (mimeType.includes('image')) return <ImageIcon color="#3B82F6" size={24} />;
    if (mimeType.includes('video')) return <Video color="#8B5CF6" size={24} />;
    if (mimeType.includes('audio')) return <Music color="#EC4899" size={24} />;
    if (mimeType.includes('pdf')) return <FileText color="#EF4444" size={24} />;
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) {
      return <FileSpreadsheet color="#22C55E" size={24} />;
    }
    if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('archive')) {
      return <FileArchive color="#F97316" size={24} />;
    }
    if (mimeType.includes('document') || mimeType.includes('word')) {
      return <FileText color="#3B82F6" size={24} />;
    }
    return <File color={theme.colors.textSecondary} size={24} />;
  };

  const handleItemPress = async (item: DriveFile) => {
    if (item.mimeType === 'application/vnd.google-apps.folder') {
      openFolder(item);
    } else {
      // Resim ve video için modal önizleme (token ile çalışır)
      const isImage = item.mimeType.startsWith('image/');
      const isVideo = item.mimeType.startsWith('video/');
      
      if (isImage || isVideo) {
        setPreviewLoading(true);
        setPreviewFile(item);
      } else {
        // Diğer dosyalar için harici tarayıcıda aç (kullanıcı orada zaten giriş yapmış)
        if (item.webViewLink) {
          await WebBrowser.openBrowserAsync(item.webViewLink);
        }
      }
    }
  };

  const getBinaryUrl = (fileId: string) => {
    return `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  };

  const handleOpenExternal = async () => {
    if (previewFile?.webViewLink) {
      setPreviewFile(null);
      await WebBrowser.openBrowserAsync(previewFile.webViewLink);
    }
  };

  const handleShare = () => {
    if (previewFile) {
      Share.share({
        message: previewFile.webViewLink || '',
        title: previewFile.name,
      });
    }
  };

  const renderItem = ({ item }: { item: DriveFile }) => (
    <TouchableOpacity 
      style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
      onPress={() => handleItemPress(item)}
      onLongPress={() => deleteFile(item)}
      activeOpacity={0.7}
    >
      <View style={[styles.cardIconContainer, { backgroundColor: theme.colors.background }]}>
        {getFileIcon(item.mimeType)}
      </View>
      <View style={styles.cardContent}>
        <Text style={[styles.fileName, { color: theme.colors.text }]} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={[styles.fileMeta, { color: theme.colors.textSecondary }]}>
          {item.mimeType === 'application/vnd.google-apps.folder' ? 'Klasör' : formatSize(item.size)}
        </Text>
      </View>
      {item.thumbnailLink ? (
        <Image source={{ uri: item.thumbnailLink }} style={styles.thumbnail} />
      ) : item.mimeType !== 'application/vnd.google-apps.folder' && (
        <TouchableOpacity 
          style={styles.deleteButton}
          onPress={() => deleteFile(item)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Trash2 color={theme.colors.error || '#EF4444'} size={18} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  const renderBreadcrumb = () => (
    <View style={styles.breadcrumbContainer}>
      {folderPath.map((folder, index) => (
        <View key={folder.id} style={styles.breadcrumbItem}>
          {index > 0 && (
            <Text style={[styles.breadcrumbSeparator, { color: theme.colors.textSecondary }]}>/</Text>
          )}
          <TouchableOpacity onPress={() => goToFolder(index)}>
            <Text 
              style={[
                styles.breadcrumbText, 
                { color: index === folderPath.length - 1 ? theme.colors.primary : theme.colors.textSecondary }
              ]}
              numberOfLines={1}
            >
              {folder.name}
            </Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );

  const styles = StyleSheet.create({
    container: { 
      flex: 1, 
      backgroundColor: accent && theme.colors.backgroundTinted ? theme.colors.backgroundTinted : theme.colors.background 
    },
    customHeader: {
      paddingTop: insets.top + 8,
      paddingHorizontal: 16,
      paddingBottom: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: accent && theme.colors.backgroundTinted
        ? theme.colors.backgroundTinted
        : theme.colors.background,
    },
    keeperTitle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    keeperIcon: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: theme.colors.primary + '15',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: theme.colors.primary + '30',
    },
    keeperText: {
      color: theme.colors.text,
      fontWeight: '800',
      fontSize: 26,
      letterSpacing: 0.8,
    },
    profileButton: {
      padding: 3,
      borderRadius: 999,
      borderWidth: 2.5,
      borderColor: theme.colors.primary + '40',
      backgroundColor: theme.colors.surface,
    },
    header: { 
      flexDirection: 'row', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      paddingHorizontal: 16, 
      paddingBottom: 8, 
      paddingTop: 8 
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
    backButton: { 
      width: 40, 
      height: 40, 
      borderRadius: 20, 
      backgroundColor: theme.colors.surface, 
      borderWidth: 1, 
      borderColor: theme.colors.border, 
      alignItems: 'center', 
      justifyContent: 'center' 
    },
    title: { fontSize: 28, fontWeight: '700', color: theme.colors.text },
    actionButtons: { flexDirection: 'row', gap: 10 },
    uploadButton: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      backgroundColor: accent || theme.colors.primary, 
      paddingHorizontal: 16, 
      paddingVertical: 8, 
      borderRadius: 24, 
      gap: 6 
    },
    logoutButton: { 
      width: 40, 
      height: 40, 
      borderRadius: 20, 
      backgroundColor: theme.colors.surface, 
      borderWidth: 1, 
      borderColor: theme.colors.border, 
      alignItems: 'center', 
      justifyContent: 'center' 
    },
    uploadButtonText: { fontWeight: '600', fontSize: 14 },
    breadcrumbContainer: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      paddingHorizontal: 16, 
      paddingBottom: 12,
      flexWrap: 'wrap'
    },
    breadcrumbItem: { flexDirection: 'row', alignItems: 'center' },
    breadcrumbText: { fontSize: 14, fontWeight: '500', maxWidth: 100 },
    breadcrumbSeparator: { marginHorizontal: 6, fontSize: 14 },
    listContent: { padding: 16, paddingTop: 0 },
    card: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      padding: 12, 
      marginBottom: 10, 
      borderRadius: 16, 
      borderWidth: 1, 
      gap: 12 
    },
    cardIconContainer: { 
      width: 44, 
      height: 44, 
      alignItems: 'center', 
      justifyContent: 'center', 
      borderRadius: 12 
    },
    cardContent: { flex: 1, gap: 2 },
    fileName: { fontSize: 15, fontWeight: '600' },
    fileMeta: { fontSize: 12 },
    thumbnail: { width: 44, height: 44, borderRadius: 8 },
    deleteButton: { 
      width: 36, 
      height: 36, 
      alignItems: 'center', 
      justifyContent: 'center',
      borderRadius: 18
    },
    emptyContainer: { 
      flex: 1, 
      alignItems: 'center', 
      justifyContent: 'center', 
      paddingTop: 100, 
      gap: 16 
    },
    emptyText: { fontSize: 16, color: theme.colors.textSecondary, textAlign: 'center' },
    // Preview Modal Styles
    previewModal: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.95)',
    },
    previewHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: insets.top + 8,
      paddingHorizontal: 16,
      paddingBottom: 12,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
    },
    previewHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      gap: 12,
    },
    previewCloseButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    previewFileInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
    },
    previewFileName: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
      flex: 1,
    },
    previewActions: {
      flexDirection: 'row',
      gap: 8,
    },
    previewActionButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    previewContent: {
      flex: 1,
      backgroundColor: '#1a1a1a',
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      overflow: 'hidden',
    },
    previewLoading: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10,
      gap: 12,
    },
    previewLoadingText: {
      color: 'rgba(255, 255, 255, 0.7)',
      fontSize: 14,
    },
    previewImage: {
      width: '100%',
      height: '100%',
    },
    previewVideoContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 20,
      padding: 32,
    },
    previewVideoText: {
      color: 'rgba(255, 255, 255, 0.7)',
      fontSize: 16,
      textAlign: 'center',
    },
    previewOpenButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 24,
      paddingVertical: 14,
      borderRadius: 12,
    },
    previewOpenButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
  });

  return (
    <View style={styles.container}>
      {/* Custom Header */}
      <View style={styles.customHeader}>
        <View style={styles.keeperTitle}>
          <View style={styles.keeperIcon}>
            <MaterialCommunityIcons name="cloud" size={22} color={theme.colors.primary} />
          </View>
          <Text style={styles.keeperText}>Keeper</Text>
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate('Profile')}
          style={styles.profileButton}
          activeOpacity={0.7}
        >
          <Avatar
            name={session?.user?.user_metadata?.full_name || session?.user?.email}
            imageUrl={session?.user?.user_metadata?.avatar_url}
            size={40}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {folderPath.length > 1 && (
            <TouchableOpacity style={styles.backButton} onPress={goBack}>
              <ChevronLeft color={theme.colors.text} size={22} />
            </TouchableOpacity>
          )}
          <Text style={styles.title}>Drive</Text>
        </View>
        <View style={styles.actionButtons}>
          {token && (
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <LogOut color={theme.colors.error || '#EF4444'} size={18} />
            </TouchableOpacity>
          )}
          <TouchableOpacity 
            style={styles.uploadButton} 
            onPress={() => !token ? handleLogin() : Alert.alert('Bilgi', 'Yükleme özelliği yakında gelecek.')}
          >
            {!token ? (
              <>
                <HardDrive color={accent ? '#fff' : (theme.dark ? '#000' : '#fff')} size={18} />
                <Text style={[styles.uploadButtonText, { color: accent ? '#fff' : (theme.dark ? '#000' : '#fff') }]}>Bağlan</Text>
              </>
            ) : (
              <>
                <Upload color={accent ? '#fff' : (theme.dark ? '#000' : '#fff')} size={18} />
                <Text style={[styles.uploadButtonText, { color: accent ? '#fff' : (theme.dark ? '#000' : '#fff') }]}>Yükle</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {token && folderPath.length > 0 && renderBreadcrumb()}

      {loading && !refreshing ? (
        <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={files}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.primary}
              colors={[theme.colors.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <HardDrive color={theme.colors.muted || theme.colors.textSecondary} size={48} />
              <Text style={styles.emptyText}>
                {!token 
                  ? 'Dosyaları görmek için\nGoogle Drive\'a bağlanın' 
                  : 'Bu klasörde dosya bulunamadı'}
              </Text>
            </View>
          }
        />
      )}

      <DeleteConfirmModal
        visible={deleteModalVisible}
        title="Dosyayı Sil"
        message={fileToDelete ? `"${fileToDelete.name}" dosyasını silmek istediğinizden emin misiniz?` : ''}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteModalVisible(false)}
      />

      {/* Dosya Önizleme Modal - Web'deki gibi */}
      <Modal
        visible={!!previewFile}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setPreviewFile(null)}
        statusBarTranslucent
      >
        <View style={styles.previewModal}>
          <StatusBar barStyle="light-content" backgroundColor="rgba(0,0,0,0.95)" />
          
          {/* Modal Header */}
          <View style={styles.previewHeader}>
            <View style={styles.previewHeaderLeft}>
              <TouchableOpacity 
                style={styles.previewCloseButton} 
                onPress={() => setPreviewFile(null)}
              >
                <MaterialCommunityIcons name="close" size={24} color="#fff" />
              </TouchableOpacity>
              <View style={styles.previewFileInfo}>
                {previewFile && getFileIcon(previewFile.mimeType)}
                <Text style={styles.previewFileName} numberOfLines={1}>
                  {previewFile?.name}
                </Text>
              </View>
            </View>
            <View style={styles.previewActions}>
              <TouchableOpacity style={styles.previewActionButton} onPress={handleShare}>
                <MaterialCommunityIcons name="share-variant" size={22} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.previewActionButton} onPress={handleOpenExternal}>
                <MaterialCommunityIcons name="open-in-new" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Preview Content - Resim ve Video için */}
          <View style={styles.previewContent}>
            {previewLoading && (
              <View style={styles.previewLoading}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={styles.previewLoadingText}>Yükleniyor...</Text>
              </View>
            )}
            {previewFile && previewFile.mimeType.startsWith('image/') && (
              <Image
                source={{
                  uri: getBinaryUrl(previewFile.id),
                  headers: { Authorization: `Bearer ${token}` }
                }}
                style={styles.previewImage}
                resizeMode="contain"
                onLoadStart={() => setPreviewLoading(true)}
                onLoad={() => setPreviewLoading(false)}
                onError={() => {
                  setPreviewLoading(false);
                  Alert.alert('Hata', 'Resim yüklenemedi');
                }}
              />
            )}
            {previewFile && previewFile.mimeType.startsWith('video/') && (
              <View style={styles.previewVideoContainer}>
                <Text style={styles.previewVideoText}>
                  Video önizlemesi için harici tarayıcıda açın
                </Text>
                <TouchableOpacity 
                  style={styles.previewOpenButton}
                  onPress={handleOpenExternal}
                >
                  <MaterialCommunityIcons name="open-in-new" size={20} color="#fff" />
                  <Text style={styles.previewOpenButtonText}>Tarayıcıda Aç</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
