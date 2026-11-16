import { fadesIn } from "@botsman/client-core";
import { memo, useMemo } from "react";
import { EnrichedMarkdownText, type MarkdownStyle } from "react-native-enriched-markdown";
import { fontFamilies, radius, type Theme, useTheme } from "../theme";

// A reply's text drawn as Markdown in native text views, with tables and code blocks. It redraws only when its text
// changes, so a streaming reply doesn't redraw the replies before it.
export const Markdown = memo(function Markdown({ text, streaming }: { text: string; streaming: boolean }) {
  const theme = useTheme();
  const style = useMemo(() => markdownStyle(theme), [theme]);
  return <EnrichedMarkdownText markdown={text} flavor="github" markdownStyle={style} streamingAnimation={fadesIn(text, streaming)} />;
});

// Matches the PC look in pc-ui's styles.css: a quote is a thin rule with muted text and no fill, inline code is mono on
// the muted background with no border, and tables and code blocks sit on the card colour with a border.
function markdownStyle({ colors }: Theme): MarkdownStyle {
  const text = { fontFamily: fontFamilies.body, fontSize: 16, lineHeight: 25, color: colors.foreground };
  const heading = (fontSize: number) => ({ fontFamily: fontFamilies.display, fontSize, color: colors.foreground, marginTop: 8, marginBottom: 4 });
  return {
    paragraph: { ...text, marginBottom: 8 },
    h1: heading(22),
    h2: heading(16),
    h3: heading(14),
    h4: heading(14),
    list: { ...text, bulletColor: colors.mutedForeground, markerColor: colors.mutedForeground },
    blockquote: { ...text, color: colors.mutedForeground, borderColor: colors.border, borderWidth: 2, gapWidth: 12, backgroundColor: "transparent", padding: 0, borderRadius: 0 },
    strong: { fontFamily: fontFamilies.bodySemiBold, color: colors.foreground },
    em: { fontStyle: "italic", color: colors.foreground },
    strikethrough: { color: colors.mutedForeground },
    link: { color: colors.primary, underline: true },
    code: { fontFamily: fontFamilies.mono, fontSize: 13, color: colors.foreground, backgroundColor: colors.muted, borderColor: "transparent" },
    codeBlock: { fontFamily: fontFamilies.mono, fontSize: 13, color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, padding: 12 },
    table: { ...text, fontSize: 14, headerFontFamily: fontFamilies.bodySemiBold, headerBackgroundColor: colors.card, headerTextColor: colors.foreground, rowEvenBackgroundColor: "transparent", rowOddBackgroundColor: "transparent", borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, cellPaddingHorizontal: 10, cellPaddingVertical: 6 },
    thematicBreak: { color: colors.border, height: 1, marginTop: 8, marginBottom: 8 },
    taskList: { checkedColor: colors.primary, borderColor: colors.border, checkmarkColor: colors.primaryForeground, checkedTextColor: colors.mutedForeground },
  };
}
