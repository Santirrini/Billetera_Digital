import React from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Switch,
  Platform,
} from 'react-native';
import { Text } from '@/components/Themed';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../constants/Colors';
import { useA11y } from '../../contexts/A11yContext';
import { a11yButton, a11yHidden, a11yLink, a11yLive, HIT_SLOP, MIN_TOUCH } from '../../utils/a11y';

interface SettingItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  color?: string;
  onPress?: () => void;
  role?: 'button' | 'link';
  hint?: string;
}

function SettingItem({
  icon,
  title,
  subtitle,
  color = '#F5A623',
  onPress,
  role = 'button',
  hint,
}: SettingItemProps) {
  const COLORS = useColors();
  const styles = makeStyles(COLORS);
  const a11y = role === 'link'
    ? a11yLink(title, hint)
    : a11yButton(title, { hint });

  return (
    <TouchableOpacity
      style={styles.settingItem}
      onPress={onPress}
      activeOpacity={0.7}
      hitSlop={HIT_SLOP}
      {...a11y}
    >
      <View style={[styles.settingIcon, { backgroundColor: color + '20' }]} {...a11yHidden}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <View style={styles.settingInfo}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingSub}>{subtitle}</Text>
      </View>
      {role === 'link' ? (
        <Ionicons name="open-outline" size={18} color={COLORS.textMuted} {...a11yHidden} />
      ) : (
        <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} {...a11yHidden} />
      )}
    </TouchableOpacity>
  );
}

interface ToggleRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  color?: string;
  hint?: string;
}

function ToggleRow({ icon, title, subtitle, value, onValueChange, color = '#F5A623', hint }: ToggleRowProps) {
  const COLORS = useColors();
  const styles = makeStyles(COLORS);
  return (
    <View style={styles.toggleRow}>
      <View style={[styles.settingIcon, { backgroundColor: color + '20' }]} {...a11yHidden}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <View style={styles.settingInfo}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingSub}>{subtitle}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: COLORS.border, true: COLORS.amberMuted }}
        thumbColor={value ? COLORS.amber : COLORS.textDim}
        accessibilityLabel={title}
        accessibilityHint={hint || 'Alternar configuración'}
      />
    </View>
  );
}

export default function SettingsScreen() {
  const COLORS = useColors();
  const styles = makeStyles(COLORS);
  const { highContrast, toggleHighContrast, systemReduceMotion, announceMessage } = useA11y();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle} accessibilityRole="header">
          Configuración
        </Text>
      </View>

      <Text
        style={styles.sectionLabel}
        accessibilityRole="header"
      >
        STACK TECNOLÓGICO
      </Text>
      <View style={styles.stackGrid}>
        {[
          { name: 'FastAPI', sub: 'Backend', icon: '⚡', color: '#00B894' },
          { name: 'React + Expo', sub: 'Frontend', icon: '⚛️', color: '#6C5CE7' },
          { name: 'Supabase', sub: 'Base de datos', icon: '🗄️', color: '#FBBF24' },
          { name: 'OpenAI', sub: 'Modelo de lenguaje', icon: '🤖', color: '#FF6B6B' },
        ].map(tech => (
          <View
            key={tech.name}
            style={styles.stackCard}
            accessible
            accessibilityRole="text"
            accessibilityLabel={`${tech.name}: ${tech.sub}`}
          >
            <Text style={styles.stackIcon} {...a11yHidden}>{tech.icon}</Text>
            <Text style={styles.stackName}>{tech.name}</Text>
            <Text style={styles.stackSub}>{tech.sub}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionLabel} accessibilityRole="header">
        ACCESIBILIDAD
      </Text>
      <View style={styles.settingsGroup} {...a11yLive('polite')}>
        <ToggleRow
          icon="contrast-outline"
          title="Alto contraste"
          subtitle="Aumenta el contraste de textos y bordes"
          value={highContrast}
          onValueChange={(v) => {
            toggleHighContrast();
            announceMessage(v ? 'Alto contraste activado' : 'Alto contraste desactivado');
          }}
          color={COLORS.amber}
          hint="Activa o desactiva el modo de alto contraste"
        />
        <View style={styles.toggleRow} accessible>
          <View style={[styles.settingIcon, { backgroundColor: COLORS.green + '20' }]} {...a11yHidden}>
            <Ionicons name="pulse-outline" size={20} color={COLORS.green} />
          </View>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Reducir movimiento</Text>
            <Text style={styles.settingSub}>
              {systemReduceMotion
                ? 'Activado por el sistema'
                : 'Sigue la preferencia del sistema'}
            </Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: systemReduceMotion ? COLORS.green + '20' : COLORS.surfaceLight },
            ]}
            accessible
            accessibilityRole="text"
            accessibilityLabel={`Reducir movimiento: ${systemReduceMotion ? 'activado' : 'desactivado'}`}
          >
            <Text
              style={[
                styles.statusText,
                { color: systemReduceMotion ? COLORS.green : COLORS.textMuted },
              ]}
            >
              {systemReduceMotion ? 'ON' : 'OFF'}
            </Text>
          </View>
        </View>
        <View style={styles.toggleRow}>
          <View style={[styles.settingIcon, { backgroundColor: '#45B7D1' + '20' }]} {...a11yHidden}>
            <Ionicons name="text-outline" size={20} color="#45B7D1" />
          </View>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Tamaño de texto</Text>
            <Text style={styles.settingSub}>
              Sigue el ajuste de tamaño de fuente del sistema ({Platform.OS})
            </Text>
          </View>
        </View>
      </View>

      <Text style={styles.sectionLabel} accessibilityRole="header">
        CUENTA
      </Text>
      <View style={styles.settingsGroup}>
        <SettingItem
          icon="mail-outline"
          title="Correo conectado"
          subtitle="No configurado"
          color="#45B7D1"
        />
        <SettingItem
          icon="key-outline"
          title="API Key LLM"
          subtitle="Configurar OpenAI"
          color="#FBBF24"
        />
      </View>

      <Text style={styles.sectionLabel} accessibilityRole="header">
        PREFERENCIAS
      </Text>
      <View style={styles.settingsGroup}>
        <SettingItem
          icon="sync-outline"
          title="Sincronización automática"
          subtitle="Desactivada"
          color={COLORS.green}
        />
        <SettingItem
          icon="pricetags-outline"
          title="Categorías"
          subtitle="9 categorías activas"
          color="#96CEB4"
        />
        <SettingItem
          icon="eye-outline"
          title="Modo de evaluación"
          subtitle="Estática + LLM fallback"
          color={COLORS.amber}
        />
      </View>

      <Text style={styles.sectionLabel} accessibilityRole="header">
        ACERCA DE
      </Text>
      <View style={styles.settingsGroup}>
        <SettingItem
          icon="logo-github"
          title="Código fuente"
          subtitle="Ver en GitHub"
          color={COLORS.text}
          role="link"
          hint="Abre el repositorio en el navegador"
          onPress={() => Linking.openURL('https://github.com')}
        />
        <SettingItem
          icon="information-circle-outline"
          title="Versión"
          subtitle="1.0.0"
          color={COLORS.textMuted}
        />
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const makeStyles = (COLORS: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.bg },
    scroll: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 40 },

    header: { marginBottom: 24 },
    headerTitle: { fontSize: 26, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5 },

    sectionLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: COLORS.textMuted,
      letterSpacing: 1,
      marginTop: 24,
      marginBottom: 10,
      marginLeft: 2,
    },

    stackGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
    stackCard: {
      width: '47%',
      minHeight: 88,
      backgroundColor: COLORS.surface,
      borderRadius: 14,
      padding: 16,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    stackIcon: { fontSize: 24, marginBottom: 8 },
    stackName: { fontSize: 14, fontWeight: '700', color: COLORS.text },
    stackSub: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },

    settingsGroup: {
      backgroundColor: COLORS.surface,
      borderRadius: 14,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    settingItem: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: MIN_TOUCH,
      padding: 14,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: MIN_TOUCH,
      padding: 14,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
    },
    settingIcon: {
      width: 38,
      height: 38,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    settingInfo: { flex: 1 },
    settingTitle: { fontSize: 14, fontWeight: '600', color: COLORS.text },
    settingSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 1 },
    statusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 10,
      minWidth: 48,
      alignItems: 'center',
      justifyContent: 'center',
    },
    statusText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  });
