import type { AppController, BotsmanClient } from "@botsman/client-core";
import { useAction } from "@botsman/client-core/react";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { space } from "../theme";
import { Button } from "../ui/button";
import { EntryCard } from "../ui/entry-card";
import { Field } from "../ui/field";

// Asks for the owner's password, on a new device or after a session ends.
export function SignInScreen({ app, client }: { app: AppController; client: BotsmanClient }) {
  const [password, setPassword] = useState("");
  const signIn = useAction(() => client.session.signIn(password));
  return (
    <EntryCard title="Sign in" lede={`Enter the owner password for ${client.baseUrl}.`} error={signIn.error}>
      <Field label="Owner password" value={password} onChangeText={setPassword} secureTextEntry onSubmitEditing={() => void signIn.run()} />
      <View style={styles.row}>
        <Button label="Sign in" variant="primary" grow disabled={signIn.busy || password === ""} onPress={() => void signIn.run()} />
        {app.canChangeServer ? <Button label="Change server" onPress={() => void app.changeServer()} /> : null}
      </View>
    </EntryCard>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: "row", gap: space[2] } });
