import React, { useEffect, useState } from 'react';
import {
    Modal,
    View,
    Text,
    StyleSheet,
    Dimensions,
    Pressable,
} from 'react-native';
import { Clock, LogIn } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withTiming,
    runOnJS,
} from 'react-native-reanimated';
import { useAppTheme } from '../lib/theme';

const { width } = Dimensions.get('window');

interface SessionExpiredModalProps {
    visible: boolean;
    onLogin: () => void;
    onCancel?: () => void; // Optional if they want to just dismiss and go back
}

export default function SessionExpiredModal({
    visible,
    onLogin,
    onCancel,
}: SessionExpiredModalProps) {
    const { theme } = useAppTheme();

    const [showModal, setShowModal] = useState(visible);
    const [isInteractive, setIsInteractive] = useState(false);

    // Animation values
    const scale = useSharedValue(0.9);
    const opacity = useSharedValue(0);

    useEffect(() => {
        if (visible) {
            setShowModal(true);
            scale.value = 0.9;
            opacity.value = 0;

            // Animate in
            scale.value = withTiming(1, { duration: 300 });
            opacity.value = withTiming(1, { duration: 300 });

            const timer = setTimeout(() => setIsInteractive(true), 100);
            return () => clearTimeout(timer);
        } else {
            setIsInteractive(false);
            // Animate out
            scale.value = withTiming(0.9, { duration: 200 });
            opacity.value = withTiming(0, { duration: 200 }, (finished) => {
                if (finished) {
                    runOnJS(setShowModal)(false);
                }
            });
        }
    }, [visible]);

    const animatedContainerStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ scale: scale.value }],
    }));

    const animatedBackdropStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
    }));

    const handleLogin = async () => {
        if (!isInteractive) return;
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onLogin();
    };

    const handleCancel = () => {
        if (!isInteractive) return;
        if (onCancel) {
            onCancel();
        }
    };

    if (!showModal) return null;

    const styles = StyleSheet.create({
        overlay: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: 'transparent',
        },
        backdrop: {
            ...StyleSheet.absoluteFillObject,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
        },
        modalContainer: {
            width: width - 50,
            maxWidth: 360,
            borderRadius: 32,
            backgroundColor: theme.colors.surface,
            padding: 32,
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 20 },
            shadowOpacity: 0.35,
            shadowRadius: 30,
            elevation: 30,
            borderWidth: 1,
            borderColor: theme.colors.border + '40',
        },
        iconContainer: {
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: theme.colors.primary + '15',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 24,
            borderWidth: 1,
            borderColor: theme.colors.primary + '30',
        },
        title: {
            fontSize: 22,
            fontWeight: '800',
            color: theme.colors.text,
            textAlign: 'center',
            marginBottom: 12,
            letterSpacing: -0.5,
        },
        message: {
            fontSize: 16,
            color: theme.colors.textSecondary,
            textAlign: 'center',
            lineHeight: 24,
            marginBottom: 32,
        },
        button: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.colors.primary,
            width: '100%',
            height: 56,
            borderRadius: 18,
            gap: 10,
            shadowColor: theme.colors.primary,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.3,
            shadowRadius: 12,
            elevation: 8,
        },
        buttonText: {
            color: '#fff',
            fontSize: 17,
            fontWeight: '700',
        },
        buttonPressed: {
            transform: [{ scale: 0.98 }],
            opacity: 0.9,
        },
        cancelButton: {
            marginTop: 16,
            paddingVertical: 12,
            paddingHorizontal: 20,
        },
        cancelText: {
            color: theme.colors.textSecondary,
            fontSize: 15,
            fontWeight: '600',
        }
    });

    return (
        <Modal
            transparent
            visible={showModal}
            animationType="none"
            onRequestClose={handleCancel}
            statusBarTranslucent
        >
            <View style={styles.overlay}>
                <Animated.View style={[styles.backdrop, animatedBackdropStyle]} />

                <Animated.View style={[styles.modalContainer, animatedContainerStyle]}>
                    <View style={styles.iconContainer}>
                        <Clock size={40} color={theme.colors.primary} strokeWidth={2.5} />
                    </View>

                    <Text style={styles.title}>Oturum Süresi Doldu</Text>
                    <Text style={styles.message}>
                        Güvenliğiniz için Google Drive oturumunuz sonlandı. Devam etmek için lütfen tekrar giriş yapın.
                    </Text>

                    <Pressable
                        onPress={handleLogin}
                        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
                    >
                        <LogIn color="#fff" size={20} strokeWidth={2.5} />
                        <Text style={styles.buttonText}>Tekrar Giriş Yap</Text>
                    </Pressable>

                    {onCancel && (
                        <Pressable onPress={handleCancel} style={styles.cancelButton}>
                            <Text style={styles.cancelText}>Daha Sonra</Text>
                        </Pressable>
                    )}
                </Animated.View>
            </View>
        </Modal>
    );
}
