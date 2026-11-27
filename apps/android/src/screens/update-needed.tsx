import { type AppController, UPDATE_NEEDED } from "@botsman/client-core";
import { useStore } from "@botsman/client-core/react";
import { StyleSheet, View } from "react-native";
import { space } from "../theme";
import { Button } from "../ui/button";
import { EntryCard } from "../ui/entry-card";
import { UpdateNotice } from "../ui/update-notice";
import { ServerUpdateSteps } from "../ui/server-version";

// Shown when the app and the server share no protocol version. Nothing else works until one side is updated.
export function UpdateNeededScreen({ app, side, address }: { app: AppController; side: keyof typeof UPDATE_NEEDED; address: string }) {
  const health = useStore(app.serverHealth);
  return (
    <EntryCard {...UPDATE_NEEDED[side]}>
      {side === "update_app" ? <UpdateNotice updates={app.updates} /> : <ServerUpdateSteps health={health} />}
      <View style={styles.row}>
        <Button label="Try again" variant="primary" grow onPress={() => void app.connect(address)} />
        {app.canChangeServer ? <Button label="Change server" onPress={() => void app.changeServer()} /> : null}
      </View>
    </EntryCard>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: "row", gap: space[2] } });
