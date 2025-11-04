import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated as RNAnimated,
  Pressable,
  TouchableOpacity,
} from 'react-native';
import Animated, { FadeInDown, FadeOutUp, Layout } from 'react-native-reanimated';
import { Swipeable } from 'react-native-gesture-handler';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '../lib/theme';
import { usePrefs } from '../lib/prefs';

const SwipeableNoteCard = ({
  note,
  onPress,
  onLongPress,
  onEdit,
  onDelete,
  onPin,
  isSelected = false,
  multiSelect = false,
  isDeleting = false,
}) => {
  const { theme, accent } = useAppTheme();
  const { hapticsEnabled } = usePrefs();
  const swipeableRef = useRef(null);

  const isPinned = note.is_pinned || false;
  const hasContent = (note.content || '').trim().length > 0;
  const displayTitle = (note.title || '').trim() || 'Başlıksız Not';

  // Right swipe actions (Edit & Pin)
  const renderRightActions = (progress, dragX) => {
    const editScale = dragX.interpolate({
      inputRange: [0, 80],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    });

    const pinScale = dragX.interpolate({
      inputRange: [80, 160],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    });

    return (
      <View style={styles.rightSwipeContainer}>
        <RNAnimated.View style={[styles.swipeAction, styles.editAction, { transform: [{ scale: editScale }] }]}>
          <Ionicons name="pencil" size={20} color="#ffffff" />
        </RNAnimated.View>
        <RNAnimated.View style={[styles.swipeAction, styles.pinAction, { transform: [{ scale: pinScale }] }]}>
          <Ionicons name={isPinned ? "pin-outline" : "pin"} size={20} color="#ffffff" />
        </RNAnimated.View>
      </View>
    );
  };

  // Left swipe actions (Delete)
  const renderLeftActions = (progress, dragX) => {
    const scale = dragX.interpolate({
      inputRange: [-80, 0],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    });

    return (
      <RNAnimated.View style={[styles.leftSwipeContainer, { backgroundColor: theme.colors.danger }]}>
        <RNAnimated.View style={{ transform: [{ scale }] }}>
          <Ionicons name="trash-outline" size={20} color="#ffffff" />
        </RNAnimated.View>
      </RNAnimated.View>
    );
  };

  const handleSwipeableOpen = (direction) => {
    if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (direction === 'right') {
      const dragDistance = swipeableRef.current?._dragX?._value || 0;
      if (dragDistance > 100) {
        onPin(note.id, !isPinned);
      } else {
        onEdit(note);
      }
    } else if (direction === 'left') {
      onDelete(note.id);
    }

    setTimeout(() => {
      swipeableRef.current?.close();
    }, 300);
  };

  const handlePress = () => {
    if (hapticsEnabled) Haptics.selectionAsync();
    onPress(note);
  };

  const handleLongPress = () => {
    if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onLongPress(note);
  };

  const styles = StyleSheet.create({
    cardContainer: {
      marginBottom: 12,
    },
    card: {
      backgroundColor: accent && theme.colors.surfaceTinted ? theme.colors.surfaceTinted : theme.colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: isSelected ? theme.colors.primary : theme.colors.border,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    cardContent: {
      padding: 16,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    leftSection: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: isSelected ? theme.colors.primary : theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isSelected ? theme.colors.primary : 'transparent',
    },
    titleContainer: {
      flex: 1,
    },
    title: {
      fontSize: 17,
      fontWeight: '600',
      color: theme.colors.text,
      lineHeight: 22,
    },
    pinBadge: {
      backgroundColor: theme.colors.warning + '20',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
      marginLeft: 8,
    },
    pinBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: theme.colors.warning,
    },
    content: {
      fontSize: 15,
      color: theme.colors.textSecondary,
      lineHeight: 20,
      marginBottom: 8,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    dateContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    date: {
      fontSize: 12,
      color: theme.colors.muted,
    },
    rightSwipeContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    leftSwipeContainer: {
      justifyContent: 'center',
      alignItems: 'flex-end',
      paddingRight: 20,
      borderTopLeftRadius: 16,
      borderBottomLeftRadius: 16,
      width: 80,
    },
    swipeAction: {
      width: 80,
      justifyContent: 'center',
      alignItems: 'center',
      height: '100%',
    },
    editAction: {
      backgroundColor: theme.colors.primary,
      borderTopRightRadius: 16,
      borderBottomRightRadius: 16,
    },
    pinAction: {
      backgroundColor: theme.colors.warning,
    },
  });

  return (
    <Animated.View
      entering={FadeInDown.duration(200)}
      exiting={FadeOutUp.duration(150)}
      layout={Layout.springify()}
      style={styles.cardContainer}
    >
      <Swipeable
        ref={swipeableRef}
        friction={2}
        leftThreshold={70}
        rightThreshold={70}
        renderLeftActions={renderLeftActions}
        renderRightActions={renderRightActions}
        onSwipeableOpen={handleSwipeableOpen}
        overshootLeft={false}
        overshootRight={false}
        enabled={!multiSelect}
      >
        <Pressable
          style={styles.card}
          onPress={handlePress}
          onLongPress={handleLongPress}
          delayLongPress={300}
        >
          <View style={styles.cardContent}>
            <View style={styles.header}>
              <View style={styles.leftSection}>
                {multiSelect && (
                  <Pressable onPress={handlePress} style={styles.checkbox}>
                    {isSelected && <Ionicons name="checkmark" size={14} color="#ffffff" />}
                  </Pressable>
                )}
                <View style={styles.titleContainer}>
                  <Text style={styles.title} numberOfLines={1}>
                    {displayTitle}
                  </Text>
                </View>
              </View>
              {isPinned && !multiSelect && (
                <View style={styles.pinBadge}>
                  <Ionicons name="pin" size={12} color={theme.colors.warning} />
                </View>
              )}
            </View>

            {hasContent && (
              <Text style={styles.content} numberOfLines={3}>
                {note.content.trim()}
              </Text>
            )}

            <View style={styles.footer}>
              <View style={styles.dateContainer}>
                <Ionicons name="time-outline" size={12} color={theme.colors.muted} />
                <Text style={styles.date}>
                  {new Date(note.updated_at || note.created_at).toLocaleDateString('tr-TR', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </Text>
              </View>
            </View>
          </View>
        </Pressable>
      </Swipeable>
    </Animated.View>
  );
};

export default SwipeableNoteCard;
