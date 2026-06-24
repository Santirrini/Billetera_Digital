import React from 'react';
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/constants/Colors';

export default function TabLayout() {
  const COLORS = useColors();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.amber,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarAccessibilityLabel: 'Navegación principal',
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.amberGlow,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 85 : 62,
          paddingBottom: Platform.OS === 'ios' ? 26 : 6,
          paddingTop: 8,
          elevation: 0,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 0.2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Panel',
          tabBarAccessibilityLabel: 'Panel principal',
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="grid-outline"
              size={size}
              color={color}
              accessible={false}
              importantForAccessibility="no"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: 'Movimientos',
          tabBarAccessibilityLabel: 'Lista de movimientos',
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="swap-vertical-outline"
              size={size}
              color={color}
              accessible={false}
              importantForAccessibility="no"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="statistics"
        options={{
          title: 'Estadísticas',
          tabBarAccessibilityLabel: 'Estadísticas y resumen',
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="bar-chart-outline"
              size={size}
              color={color}
              accessible={false}
              importantForAccessibility="no"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Config',
          tabBarAccessibilityLabel: 'Configuración y accesibilidad',
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="settings-outline"
              size={size}
              color={color}
              accessible={false}
              importantForAccessibility="no"
            />
          ),
        }}
      />
    </Tabs>
  );
}
