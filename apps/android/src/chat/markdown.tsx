import { useMemo } from "react";
import { EnrichedMarkdownText } from "react-native-enriched-markdown";
import { fontFamilies, radius, type Theme, useTheme } from "../theme";

// A reply's text drawn as Markdown in native text views, with tables and code blocks.
export function Markdown({ text, streaming }: { text: string; streaming: boolean }) {
  const theme = useTheme();
  const style = useMemo(() => markdownStyle(theme), [theme]);
  return <EnrichedMarkdownText markdown={text} flavor="github" markdownStyle={style} streamingAnimation={streaming} />;
}

function markdownStyle({ colors }: Theme) {
  const text = { fontFamily: fontFamilies.body, fontSize: 16, lineHeight: 25, color: colors.foreground };
  const heading = (fontSize: number) => ({ fontFamily: fontFamilies.display, fontSize, color: colors.foreground, marginTop: 8, marginBottom: 4 });
  return {
    paragraph: { ...text, marginBottom: 8 },
    h1: heading(22),
    h2: heading(16),
    h3: heading(14),
    h4: heading(14),
    list: { ...text, bulletColor: colors.mutedForeground, markerColor: colors.mutedForeground },
    blockquote: { ...text, color: colors.mutedForeground, borderColor: colors.border, borderWidth: 2 },
    strong: { fontFamily: fontFamilies.bodySemiBold, color: colors.foreground },
    link: { color: colors.primary, underline: true },
    code: { fontFamily: fontFamilies.mono, fontSize: 13, color: colors.foreground, backgroundColor: colors.muted },
    codeBlock: { fontFamily: fontFamilies.mono, fontSize: 13, color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, padding: 12 },
  };
}
