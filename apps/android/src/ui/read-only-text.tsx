import { StyleSheet, Text, View } from "react-native";
import { Markdown } from "../chat/markdown";
import { fontFamilies, radius, space, useTheme } from "../theme";

// A memory file or note as it reads, before the owner chooses to edit it.
export function ReadOnlyText({ text }: { text: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.box, { borderColor: colors.border }]}>
      {text.trim() === "" ? <Text style={[styles.empty, { color: colors.mutedForeground }]}>Empty</Text> : <Markdown text={text} streaming={false} />}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: radius.md, padding: space[3] },
  empty: { fontFamily: fontFamilies.body, fontSize: 14 },
});
