import type { AppController } from "@botsman/client-core";
import { useStore } from "@botsman/client-core/react";
import { StyleSheet, View } from "react-native";
import { space } from "../theme";
import { Button } from "../ui/button";
import { EntryCard } from "../ui/entry-card";
import { UpdateNotice } from "../ui/update-notice";
import { ServerUpdateSteps } from "../ui/server-version";

const COPY = {
  update_app: { title: "Update the app", lede: "This app is too old for your server. Install the newest version of the app, then open it again." },
  update_server: { title: "Update the server", lede: "Your server is older than this app. Update the server, then try again." },
};

// Shown when the app and the server share no protocol version. Nothing else works until one side is updated.
export function UpdateNeededScreen({ app, side, address }: { app: AppController; side: keyof typeof COPY; address: string }) {
  const health = useStore(app.serverHealth);
  return (
    <EntryCard title={COPY[side].title} lede={COPY[side].lede}>
      {side === "update_app" ? <UpdateNotice updates={app.updates} /> : <ServerUpdateSteps health={health} />}
      <View style={styles.row}>
        <Button label="Try again" variant="primary" grow onPress={() => void app.connect(address)} />
        {app.canChangeServer ? <Button label="Change server" onPress={() => void app.changeServer()} /> : null}
      </View>
    </EntryCard>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: "row", gap: space[2] } });
