import React from 'react';
import { AlertCircle, Lightbulb, Code, Shield } from 'lucide-react';
import { getSensitivityColor, getSensitivityBgColor, getTextColor, getCategoryColor } from '@/lib/colors';

interface DirectoryIntelligence {
  path: string;
  statusCode: number;
  category: string;
  sensitivityLevel: string;
  risks: string[];
  recommendations: string[];
  technologyIndicators: string[];
  riskScore: number;
}

interface DirectoryIntelligenceCardProps {
  directory: DirectoryIntelligence;
}

export const DirectoryIntelligenceCard: React.FC<DirectoryIntelligenceCardProps> = ({ directory }) => {
  const sensitivityColor = getSensitivityColor(directory.sensitivityLevel);
  const sensitivityBgColor = getSensitivityBgColor(directory.sensitivityLevel);
  const textColor = getTextColor(directory.sensitivityLevel);
  const categoryColor = getCategoryColor(directory.category);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'admin': return '🔐';
      case 'config': return '⚙️';
      case 'backup': return '💾';
      case 'infoDisclosure': return '📄';
      case 'api': return '🔌';
      case 'upload': return '📤';
      default: return '📁';
    }
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      admin: 'Admin Panel',
      config: 'Configuration',
      backup: 'Backup File',
      infoDisclosure: 'Info Disclosure',
      api: 'API Endpoint',
      upload: 'Upload Directory',
      normal: 'Normal'
    };
    return labels[category] || category;
  };

  const getStatusColor = (code: number) => {
    if (code >= 200 && code < 300) return 'text-green-600';
    if (code >= 300 && code < 400) return 'text-blue-600';
    if (code >= 400 && code < 500) return 'text-orange-600';
    if (code >= 500) return 'text-red-600';
    return 'text-gray-600';
  };

  return (
    <div 
      className="border-l-4 rounded-lg p-4 space-y-3 bg-white shadow-sm hover:shadow-md transition-shadow"
      style={{ 
        borderLeftColor: sensitivityColor,
        backgroundColor: sensitivityBgColor + '10'
      }}
    >
      {/* Header */}
      <div className="flex justify-between items-start gap-3">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <span className="text-2xl flex-shrink-0" title={getCategoryLabel(directory.category)}>
            {getCategoryIcon(directory.category)}
          </span>
          <div className="flex-1 min-w-0">
            <h3 className="font-mono font-semibold text-sm break-all">
              {directory.path}
            </h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className={`text-xs font-medium ${getStatusColor(directory.statusCode)}`}>
                HTTP {directory.statusCode}
              </span>
              <span 
                className="text-xs px-2 py-0.5 rounded font-medium border"
                style={{ 
                  color: categoryColor,
                  borderColor: categoryColor,
                  backgroundColor: categoryColor + '15'
                }}
              >
                {getCategoryLabel(directory.category)}
              </span>
            </div>
          </div>
        </div>
        <div 
          className="px-3 py-1 rounded font-semibold text-xs whitespace-nowrap flex-shrink-0"
          style={{ 
            color: textColor,
            backgroundColor: sensitivityBgColor
          }}
        >
          {directory.sensitivityLevel.toUpperCase()}
        </div>
      </div>

      {/* Technology Indicators */}
      {directory.technologyIndicators && directory.technologyIndicators.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Code className="w-4 h-4 text-gray-600 flex-shrink-0" />
          <div className="flex gap-1 flex-wrap">
            {directory.technologyIndicators.map((tech, idx) => (
              <span 
                key={idx} 
                className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded border border-blue-200 font-medium"
              >
                {tech}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Risk Score */}
      {directory.riskScore && (
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-gray-600" />
          <div className="flex-1 bg-gray-200 rounded-full h-2">
            <div 
              className="h-2 rounded-full transition-all"
              style={{ 
                width: `${directory.riskScore}%`,
                backgroundColor: getSensitivityColor(directory.sensitivityLevel)
              }}
            />
          </div>
          <span className="text-xs font-semibold text-gray-700">
            {directory.riskScore}/100
          </span>
        </div>
      )}

      {/* Two-column layout for Risks and Recommendations */}
      <div className="grid md:grid-cols-2 gap-3">
        {/* Security Risks */}
        {directory.risks && directory.risks.length > 0 && (
          <div>
            <h4 className="font-medium flex items-center gap-2 text-red-600 mb-1 text-sm">
              <AlertCircle className="w-4 h-4" />
              Security Risks
            </h4>
            <ul className="text-xs space-y-0.5">
              {directory.risks.map((risk, idx) => (
                <li key={idx} className="flex items-start gap-1.5">
                  <span className="text-red-500 mt-0.5 flex-shrink-0">•</span>
                  <span className="text-gray-700">{risk}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recommendations */}
        {directory.recommendations && directory.recommendations.length > 0 && (
          <div>
            <h4 className="font-medium flex items-center gap-2 text-blue-600 mb-1 text-sm">
              <Lightbulb className="w-4 h-4" />
              Recommendations
            </h4>
            <ul className="text-xs space-y-0.5">
              {directory.recommendations.map((rec, idx) => (
                <li key={idx} className="flex items-start gap-1.5">
                  <span className="text-blue-500 mt-0.5 flex-shrink-0">✓</span>
                  <span className="text-gray-700">{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default DirectoryIntelligenceCard;
