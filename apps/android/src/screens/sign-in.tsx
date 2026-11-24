import type { AppController, BotsmanClient } from "@botsman/client-core";
import { useSignInForm } from "@botsman/client-core/react";
import { StyleSheet, View } from "react-native";
import { space } from "../theme";
import { Button } from "../ui/button";
import { EntryCard } from "../ui/entry-card";
import { Field } from "../ui/field";

// Asks for the owner's password, on a new device or after a session ends.
export function SignInScreen({ app, client }: { app: AppController; client: BotsmanClient }) {
  const form = useSignInForm(client);
  return (
    <EntryCard title="Sign in" lede={`Enter the owner password for ${client.baseUrl}.`} error={form.error}>
      <Field label="Owner password" value={form.password} onChangeText={form.setPassword} secureTextEntry onSubmitEditing={form.submit} />
      <View style={styles.row}>
        <Button label="Sign in" variant="primary" grow disabled={!form.ready} onPress={form.submit} />
        {app.canChangeServer ? <Button label="Change server" onPress={() => void app.changeServer()} /> : null}
      </View>
    </EntryCard>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: "row", gap: space[2] } });
