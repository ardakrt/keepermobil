import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import {
  File,
  Upload,
  Folder,
  FileText,
  Image as ImageIcon,
  HardDrive,
  MoreVertical,
} from 'lucide-react-native';
import { useAppTheme } from '../lib/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

WebBrowser.maybeCompleteAuthSession();

export default function DriveScreen({ navigation }) {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [token, setToken] = useState(null);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);

  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: '313224563070-ld3s9m5p7v6i0h9139fg4ridukrtjc7g.apps.googleusercontent.com',
    webClientId: '313224563070-6gddknt4kevc9e9rhs408ocnsepe7h3j.apps.googleusercontent.com',
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });

  useEffect(() => {
    if (response?.type === 'success') {
      setToken(response.authentication.accessToken);
      fetchFiles(response.authentication.accessToken);
    }
  }, [response]);

  const fetchFiles = async (accessToken) => {
    setLoading(true);
    try {
      const response = await fetch(
        'https://www.googleapis.com/drive/v3/files?fields=files(id,name,mimeType,size,thumbnailLink)&pageSize=50',
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      const data = await response.json();
      if (data.files) {
        setFiles(data.files);
      } else {
        Alert.alert('Hata', 'Dosya listesi alınamadı.');
      }
    } catch (error) {
      Alert.alert('Hata', 'Bağlantı hatası oluştu.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return '-';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getFileIcon = (mimeType) => {
    const color = theme.colors.textSecondary;
    if (mimeType.includes('folder')) return <Folder color={theme.colors.primary} size={24} />;
    if (mimeType.includes('image')) return <ImageIcon color={color} size={24} />;
    if (mimeType.includes('text') || mimeType.includes('document'))
      return <FileText color={color} size={24} />;
    return <File color={color} size={24} />;
  };

  const renderItem = ({ item }) => (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
      ]}
    >
      <View style={styles.cardIconContainer}>{getFileIcon(item.mimeType)}</View>
      <View style={styles.cardContent}>
        <Text style={[styles.fileName, { color: theme.colors.text }]} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={[styles.fileMeta, { color: theme.colors.textSecondary }]}>
          {item.mimeType.includes('folder') ? 'Klasör' : formatSize(item.size)}
        </Text>
      </View>
      {item.thumbnailLink && (
        <Image source={{ uri: item.thumbnailLink }} style={styles.thumbnail} />
      )}
    </View>
  );

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingBottom: 16,
      paddingTop: 8,
    },
    title: {
      fontSize: 32,
      fontWeight: '700',
      color: theme.colors.text,
    },
    uploadButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 24,
      gap: 6,
    },
    uploadButtonText: {
      color: '#fff',
      fontWeight: '600',
      fontSize: 14,
    },
    listContent: {
      padding: 16,
      paddingTop: 0,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      marginBottom: 12,
      borderRadius: 16,
      borderWidth: 1,
      gap: 12,
    },
    cardIconContainer: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.background,
      borderRadius: 12,
    },
    cardContent: {
      flex: 1,
      gap: 4,
    },
    fileName: {
      fontSize: 16,
      fontWeight: '600',
    },
    fileMeta: {
      fontSize: 12,
    },
    thumbnail: {
      width: 40,
      height: 40,
      borderRadius: 8,
    },
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 100,
      gap: 16,
    },
    emptyText: {
      fontSize: 16,
      color: theme.colors.textSecondary,
    },
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Drive</Text>
        <TouchableOpacity
          style={styles.uploadButton}
          onPress={() => !token ? promptAsync() : Alert.alert('Bilgi', 'Yükleme özelliği yakında gelecek.')}
        >
          {!token ? (
            <>
              <HardDrive color="#fff" size={18} />
              <Text style={styles.uploadButtonText}>Bağlan</Text>
            </>
          ) : (
            <>
              <Upload color="#fff" size={18} />
              <Text style={styles.uploadButtonText}>Yükle</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={files}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <HardDrive color={theme.colors.muted} size={48} />
              <Text style={styles.emptyText}>
                {!token ? 'Dosyaları görmek için giriş yapın' : 'Dosya bulunamadı'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}
