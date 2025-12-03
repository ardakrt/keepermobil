import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { parseOTPAuthURI } from '../lib/totp';
import { parseGoogleAuthMigration } from '../lib/googleAuthMigration';

export default function QRScanner({ onScan, onClose }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission]);

  const handleBarCodeScanned = ({ type, data }) => {
    if (scanned) return;
    setScanned(true);

    try {
      // Try Google Auth migration format first
      if (data.startsWith('otpauth-migration://')) {
        const codes = parseGoogleAuthMigration(data);
        if (codes && codes.length > 0) {
          onScan(codes);
          return;
        }
      }

      // Try standard otpauth:// format
      if (data.startsWith('otpauth://')) {
        const parsed = parseOTPAuthURI(data);
        if (parsed) {
          onScan([{
            serviceName: parsed.issuer || parsed.account,
            accountName: parsed.account,
            issuer: parsed.issuer,
            secret: parsed.secret,
            algorithm: parsed.algorithm,
            digits: parsed.digits,
            period: parsed.period,
          }]);
          return;
        }
      }

      // Invalid QR code
      Alert.alert(
        'Geçersiz QR Kod',
        'Bu bir 2FA QR kodu değil. Lütfen Google Authenticator veya başka bir 2FA QR kodu tarayın.',
        [{ text: 'Tamam', onPress: () => setScanned(false) }]
      );
    } catch (error) {
      console.error('QR scan error:', error);
      Alert.alert(
        'Hata',
        'QR kod okunurken bir hata oluştu.',
        [{ text: 'Tamam', onPress: () => setScanned(false) }]
      );
    }
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Kamera izni kontrol ediliyor...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Kamera erişimi gerekiyor</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>İzin Ver</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonText}>Kapat</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      />

      {/* Overlay */}
      <View style={styles.overlay}>
        <View style={styles.header}>
          <Text style={styles.title}>QR Kod Tara</Text>
          <Text style={styles.subtitle}>
            Google Authenticator veya başka bir 2FA QR kodunu tarayın
          </Text>
        </View>

        {/* Scan frame */}
        <View style={styles.scanFrame}>
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />
        </View>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>İptal</Text>
          </TouchableOpacity>
          {scanned && (
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => setScanned(false)}
            >
              <Text style={styles.retryButtonText}>Tekrar Tara</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  text: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    margin: 20,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    padding: 40,
    paddingTop: 60,
    alignItems: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    textAlign: 'center',
  },
  scanFrame: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#10b981',
  },
  topLeft: {
    top: -120,
    left: -120,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  topRight: {
    top: -120,
    right: -120,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  bottomLeft: {
    bottom: -120,
    left: -120,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  bottomRight: {
    bottom: -120,
    right: -120,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
  footer: {
    padding: 40,
    paddingBottom: 60,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  cancelButton: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  retryButton: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    backgroundColor: '#10b981',
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  permissionButton: {
    marginTop: 20,
    paddingHorizontal: 32,
    paddingVertical: 16,
    backgroundColor: '#10b981',
    borderRadius: 12,
    alignSelf: 'center',
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  closeButton: {
    marginTop: 20,
    paddingHorizontal: 32,
    paddingVertical: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
