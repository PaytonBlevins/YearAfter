/**
 * App root.
 *
 * Composition order matters: safe area -> persistence -> game state ->
 * navigation -> shell. Nothing below the game provider can render before a save
 * has loaded, which is why the shell short-circuits on `ready`.
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { MemorySaveRepository, type SaveRepository } from '@yearafter/persistence';
import { GameProvider } from '../stores/gameStore';
import { NavigationProvider } from '../navigation/navigation';
import { Shell } from './Shell';
import { openSaveRepository } from '../stores/repository';
import { colors, spacing, typography } from '../theme/theme';

export function App() {
  const [repository, setRepository] = useState<SaveRepository | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void openSaveRepository()
      .then((repo) => {
        if (!cancelled) setRepository(repo);
      })
      .catch((cause: unknown) => {
        // A device with unusable storage should still be playable for the
        // session rather than showing a dead screen. The player is told.
        if (!cancelled) {
          setStorageError(String(cause));
          setRepository(new MemorySaveRepository());
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!repository) {
    return (
      <SafeAreaProvider>
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <GameProvider repository={repository}>
          <NavigationProvider>
            {storageError ? (
              <View style={styles.banner}>
                <Text style={styles.bannerText}>
                  Saving is unavailable on this device — progress will not persist.
                </Text>
              </View>
            ) : null}
            <Shell />
          </NavigationProvider>
        </GameProvider>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  banner: {
    backgroundColor: colors.caution,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.lg,
  },
  bannerText: {
    fontFamily: typography.family,
    fontSize: typography.sizes.caption,
    color: '#FFFFFF',
  },
});
