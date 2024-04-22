import {
  getCustomEmojiURL,
  isCustomEmoji,
} from "~/utils/replace-custom-emojis";

export function convertEmojiCodeToEmoji(
  emojiCode: string | null,
  cdnHost: string = "",
  as: "string" | "react",
  className: string = "emoji"
): string | null | React.ReactNode {
  if (!emojiCode) {
    return null;
  }
  const isCustom = isCustomEmoji(emojiCode);
  if (isCustom) {
    const url = getCustomEmojiURL(emojiCode, cdnHost);
    if (as === "react") {
      return <img className={className} src={url as string} alt={emojiCode} />;
    } else {
      return `![${emojiCode}](${encodeURIComponent(url as string)})`;
    }
  }
  try {
    const codePoints = emojiCode.split("-").map((cp) => parseInt(cp, 16));
    return String.fromCodePoint(...codePoints);
  } catch (e) {
    return emojiCode;
  }
}
