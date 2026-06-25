import { languageColors } from "./constant";

export const getLanguageColor = (language: string): string => {
  return languageColors[language] || "#CCCCCC";
};

/**
 * Get color based on risk score (0-100)
 */
export const getRiskColor = (riskScore: number): string => {
  if (riskScore >= 70) return "#DC2626"; // red-600
  if (riskScore >= 40) return "#EA580C"; // orange-600
  if (riskScore >= 20) return "#CA8A04"; // yellow-600
  return "#16A34A"; // green-600
};

/**
 * Get background color based on risk score (0-100)
 */
export const getRiskBgColor = (riskScore: number): string => {
  if (riskScore >= 70) return "#FEE2E2"; // red-100
  if (riskScore >= 40) return "#FFEDD5"; // orange-100
  if (riskScore >= 20) return "#FEF9C3"; // yellow-100
  return "#DCFCE7"; // green-100
};

/**
 * Get color based on sensitivity level
 */
export const getSensitivityColor = (level: string): string => {
  switch (level.toLowerCase()) {
    case 'critical': return "#DC2626"; // red-600
    case 'high': return "#EA580C"; // orange-600
    case 'medium': return "#CA8A04"; // yellow-600
    case 'low': return "#16A34A"; // green-600
    default: return "#6B7280"; // gray-500
  }
};

/**
 * Get background color based on sensitivity level
 */
export const getSensitivityBgColor = (level: string): string => {
  switch (level.toLowerCase()) {
    case 'critical': return "#FEE2E2"; // red-100
    case 'high': return "#FFEDD5"; // orange-100
    case 'medium': return "#FEF9C3"; // yellow-100
    case 'low': return "#DCFCE7"; // green-100
    default: return "#F3F4F6"; // gray-100
  }
};

/**
 * Get color based on category
 */
export const getCategoryColor = (category: string): string => {
  const categoryColors: Record<string, string> = {
    admin: "#7C3AED", // purple-600
    config: "#DB2777", // pink-600
    backup: "#0891B2", // cyan-600
    infoDisclosure: "#F59E0B", // amber-600
    api: "#3B82F6", // blue-600
    upload: "#10B981", // emerald-600
    normal: "#6B7280" // gray-500
  };
  return categoryColors[category] || categoryColors.normal;
};

/**
 * Get text color for light backgrounds
 */
export const getTextColor = (level: string): string => {
  switch (level.toLowerCase()) {
    case 'critical': return "#991B1B"; // red-800
    case 'high': return "#9A3412"; // orange-800
    case 'medium': return "#854D0E"; // yellow-800
    case 'low': return "#166534"; // green-800
    default: return "#374151"; // gray-700
  }
};

