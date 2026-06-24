import { Link, Stack } from 'expo-router';
import { StyleSheet } from 'react-native';
import { a11yLink } from '@/utils/a11y';
import { Text, View } from '@/components/Themed';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Página no encontrada' }} />
      <View style={styles.container}>
        <Text style={styles.title} accessibilityRole="header">
          Página no encontrada
        </Text>
        <Text style={styles.subtitle}>La ruta solicitada no existe.</Text>
        <Link
          href="/"
          style={styles.link}
          {...a11yLink('Volver al inicio', 'Te lleva al panel principal')}
        >
          <Text style={styles.linkText}>Volver al inicio</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    marginBottom: 24,
    textAlign: 'center',
  },
  link: {
    marginTop: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  linkText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
