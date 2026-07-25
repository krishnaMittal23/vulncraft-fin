import { cn } from "@/lib/utils";


/**
 * VulnCraft brand mark: a shield enclosing a ">_" terminal glyph.
 * Uses currentColor, so set a text color on it (e.g. text-[#4be277]).
 */
const VulnCraftLogo = ({ className }) => {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      role="img"
      aria-label="VulnCraft"
      className={cn("text-[#4be277]", className)}
    >
      {/* Shield */}
      <path
        d="M24 4 L40 10 V24 C40 33 33 40 24 44 C15 40 8 33 8 24 V10 Z"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* ">" chevron */}
      <path
        d="M19 19 L24 24 L19 29"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* "_" underscore */}
      <path
        d="M26.5 30 H32"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
};

export default VulnCraftLogo;
