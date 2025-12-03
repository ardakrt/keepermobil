import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, Dimensions, Image, TouchableOpacity, Share, Linking } from 'react-native';
import { WebView } from 'react-native-webview';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useAppTheme } from '../lib/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function FileViewerScreen({ route, navigation }) {
  const { file, token } = route.params;
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const isImage = file.mimeType?.startsWith('image/');
  const isVideo = file.mimeType?.startsWith('video/');
  
  // Google Drive preview URL - web'deki gibi çalışır
  const previewUrl = `https://drive.google.com/file/d/${file.id}/preview`;
  
  // Alternatif: doğrudan view linki
  const viewUrl = file.webViewLink;
  
  // Binary dosyalar için (resim/video)
  const binaryUri = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`;

  // Video Player Hook - must be called unconditionally
  const player = useVideoPlayer(isVideo ? {
    uri: binaryUri,
    headers: { Authorization: `Bearer ${token}` }
  } : null, player => {
    player.loop = true;
  });

  useEffect(() => {
    if (!player) return;

    const subscription = player.addListener('statusChange', (payload) => {
      if (payload.status === 'readyToPlay') {
        setLoading(false);
      } else if (payload.status === 'error') {
        setLoading(false);
        setError(true);
      } else if (payload.status === 'loading') {
        setLoading(true);
      }
    });

    return () => subscription.remove();
  }, [player]);

  // Header'ı özelleştir
  React.useLayoutEffect(() => {
    navigation.setOptions({
      title: file.name?.length > 25 ? file.name.substring(0, 25) + '...' : file.name,
      headerRight: () => (
        <View style={{ flexDirection: 'row', gap: 8, marginRight: 8 }}>
          <TouchableOpacity
            onPress={() => Share.share({ message: viewUrl || previewUrl, title: file.name })}
            style={styles.headerButton}
          >
            <MaterialCommunityIcons name="share-variant" size={22} color={theme.colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => Linking.openURL(viewUrl || previewUrl)}
            style={styles.headerButton}
          >
            <MaterialCommunityIcons name="open-in-new" size={22} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, file, theme]);

  // Resim önizleme
  if (isImage) {
    return (
      <View style={[styles.container, { backgroundColor: '#000' }]}>
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#fff" />
          </View>
        )}
        <Image 
          source={{ 
            uri: binaryUri, 
            headers: { Authorization: `Bearer ${token}` } 
          }} 
          style={styles.fullScreen}
          resizeMode="contain"
          onLoadStart={() => setLoading(true)}
          onLoad={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setError(true);
          }}
        />
        {error && (
          <View style={styles.errorContainer}>
            <MaterialCommunityIcons name="image-off" size={48} color="#fff" />
            <Text style={styles.errorText}>Resim yüklenemedi</Text>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={() => Linking.openURL(viewUrl || previewUrl)}
            >
              <Text style={styles.retryText}>Tarayıcıda Aç</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  // Video önizleme
  if (isVideo) {
    return (
      <View style={[styles.container, { backgroundColor: '#000' }]}>
        <VideoView
          player={player}
          style={styles.fullScreen}
          allowsFullscreen
          allowsPictureInPicture
          contentFit="contain"
        />
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#fff" />
          </View>
        )}
        {error && (
          <View style={styles.errorContainer}>
            <MaterialCommunityIcons name="video-off" size={48} color="#fff" />
            <Text style={styles.errorText}>Video yüklenemedi</Text>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={() => Linking.openURL(viewUrl || previewUrl)}
            >
              <Text style={styles.retryText}>Tarayıcıda Aç</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  // PDF, Google Docs, Sheets ve diğer dosyalar için WebView
  // Google Drive'ın /preview endpoint'ini kullanıyoruz (web'deki gibi)
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <WebView
        source={{ uri: previewUrl }}
        style={{ flex: 1 }}
        startInLoadingState={true}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        sharedCookiesEnabled={true}
        thirdPartyCookiesEnabled={true}
        onError={() => setError(true)}
        onHttpError={() => setError(true)}
        renderLoading={() => (
          <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
              Önizleme yükleniyor...
            </Text>
          </View>
        )}
        renderError={() => (
          <View style={[styles.errorContainer, { backgroundColor: theme.colors.background }]}>
            <MaterialCommunityIcons name="file-alert" size={48} color={theme.colors.muted} />
            <Text style={[styles.errorText, { color: theme.colors.text }]}>
              Önizleme yüklenemedi
            </Text>
            <Text style={[styles.errorSubtext, { color: theme.colors.textSecondary }]}>
              Bu dosya türü desteklenmiyor olabilir
            </Text>
            <TouchableOpacity 
              style={[styles.retryButton, { backgroundColor: theme.colors.primary }]}
              onPress={() => Linking.openURL(viewUrl || previewUrl)}
            >
              <MaterialCommunityIcons name="open-in-new" size={18} color="#fff" />
              <Text style={styles.retryText}>Tarayıcıda Aç</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  fullScreen: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    marginTop: 8,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 32,
  },
  errorText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  errorSubtext: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  retryText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  headerButton: {
    padding: 8,
    borderRadius: 8,
  },
});
