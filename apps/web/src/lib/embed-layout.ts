/** Theme block layout params passed into customer embeds via query string. */

export type EmbedCols = "1" | "2";
export type EmbedWidth = "full" | "wide" | "medium" | "compact";
export type EmbedStyle = "cards" | "flat";

export function parseEmbedLayout(params: {
  get(name: string): string | null;
}): {
  cols: EmbedCols;
  width: EmbedWidth;
  style: EmbedStyle;
} {
  const colsRaw = params.get("cols");
  const widthRaw = params.get("width");
  const styleRaw = params.get("style");
  return {
    cols: colsRaw === "1" ? "1" : "2",
    width:
      widthRaw === "full" || widthRaw === "medium" || widthRaw === "compact" || widthRaw === "wide"
        ? widthRaw
        : "wide",
    style: styleRaw === "flat" ? "flat" : "cards",
  };
}
