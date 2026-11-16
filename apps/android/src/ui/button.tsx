import { Pressable, StyleSheet, Text } from "react-native";
import { fontFamilies, radius, space, useTheme } from "../theme";

type Variant = "primary" | "ghost" | "text" | "danger";

// The app's button, with the same four looks as the Windows app's.
export function Button({ label, onPress, variant = "ghost", disabled = false, grow = false }: { label: string; onPress: () => void; variant?: Variant; disabled?: boolean; grow?: boolean }) {
  const { colors } = useTheme();
  const looks = {
    primary: { background: colors.primary, border: colors.primary, text: colors.primaryForeground },
    ghost: { background: "transparent", border: colors.border, text: colors.foreground },
    text: { background: "transparent", border: "transparent", text: colors.foreground },
    danger: { background: "transparent", border: colors.destructive, text: colors.destructive },
  }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, { backgroundColor: looks.background, borderColor: looks.border, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 }, grow && styles.grow]}
    >
      <Text style={[styles.label, { color: looks.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space[4], paddingVertical: space[2], minHeight: 40, alignItems: "center", justifyContent: "center" },
  grow: { flex: 1 },
  label: { fontFamily: fontFamilies.bodySemiBold, fontSize: 14 },
});
