import type { AppController } from "@botsman/client-core";
import { useAppName, useAction, useProviders } from "@botsman/client-core/react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { fontFamilies, space, useTheme } from "../theme";
import { Button } from "../ui/button";
import { ErrorText, Note } from "../ui/page";
import { ProviderList } from "../ui/provider-list";

// First run, after setup: connect the model provider bots need to run. It can be skipped and done later in Settings.
export function AddProviderScreen({ app }: { app: AppController }) {
  const appName = useAppName();
  const { colors } = useTheme();
  const { providers } = useProviders();
  const connected = providers?.some((provider) => provider.connected) ?? false;
  const finish = useAction(() => app.finishSetup());
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={[styles.wordmark, { color: colors.foreground }]}>{appName.toUpperCase()}</Text>
        <Note>Step 2 of 2</Note>
        <Text style={[styles.title, { color: colors.foreground }]}>ADD A MODEL PROVIDER</Text>
        <Note>Bots need one provider to run. Its key or sign-in is stored only on the server, and it can't be viewed after saving.</Note>
        <ProviderList />
        <ErrorText>{finish.error}</ErrorText>
        <View style={styles.buttons}>
          <Button label="Skip for now" variant="text" disabled={finish.busy} onPress={() => void finish.run()} />
          <Button label="Continue" variant="primary" disabled={!connected || finish.busy} onPress={() => void finish.run()} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { padding: space[4], gap: space[4] },
  wordmark: { fontFamily: fontFamilies.displayRegular, fontSize: 18, letterSpacing: 6 },
  title: { fontFamily: fontFamilies.display, fontSize: 20 },
  buttons: { flexDirection: "row", justifyContent: "flex-end", gap: space[2] },
});
