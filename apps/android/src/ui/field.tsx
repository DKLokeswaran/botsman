import { StyleSheet, Text, TextInput, type TextInputProps, View } from "react-native";
import { fontFamilies, radius, space, useTheme } from "../theme";

// A labelled text input.
export function Field({ label, hint, ...rest }: TextInputProps & { label: string; hint?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.mutedForeground}
        autoCapitalize="none"
        autoCorrect={false}
        style={[styles.input, { color: colors.foreground, borderColor: colors.input, backgroundColor: colors.background }]}
        {...rest}
      />
      {hint === undefined ? null : <Text style={[styles.hint, { color: colors.mutedForeground }]}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: space[2] },
  label: { fontFamily: fontFamilies.bodyMedium, fontSize: 14 },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space[3], paddingVertical: space[2], fontFamily: fontFamilies.body, fontSize: 14, minHeight: 44 },
  hint: { fontFamily: fontFamilies.body, fontSize: 12 },
});
