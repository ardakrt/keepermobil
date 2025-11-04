import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

// A simple list of good-looking, dark-theme-friendly gradient colors.
const COLORS = [
  ['#8b5cf6', '#c4b5fd'],
  ['#3b82f6', '#93c5fd'],
  ['#10b981', '#6ee7b7'],
  ['#f97316', '#fdba74'],
  ['#ec4899', '#f9a8d4'],
  ['#14b8a6', '#5eead4'],
];

// Simple hash function to get a consistent color based on a string (e.g., user's name)
const getColor = (name) => {
  if (!name) return COLORS[0];
  const charCodeSum = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return COLORS[charCodeSum % COLORS.length];
};

const Avatar = ({ name, imageUrl, size = 100 }) => {
  const initial = useMemo(() => (name ? name.charAt(0).toUpperCase() : ''), [name]);
  const gradientColors = useMemo(() => getColor(name), [name]);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      width: size,
      height: size,
      borderRadius: size / 2,
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden', // Ensures the image respects the border radius
    },
    gradient: {
      flex: 1,
      width: '100%',
      justifyContent: 'center',
      alignItems: 'center',
    },
    initialText: {
      fontSize: size * 0.45,
      color: 'white',
      fontWeight: 'bold',
    },
    image: {
      width: '100%',
      height: '100%',
    },
  }), [size]);

  if (imageUrl) {
    return (
      <View style={styles.container}>
        <Image source={{ uri: imageUrl }} style={styles.image} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={gradientColors} style={styles.gradient}>
        <Text style={styles.initialText}>{initial}</Text>
      </LinearGradient>
    </View>
  );
};

export default Avatar;
