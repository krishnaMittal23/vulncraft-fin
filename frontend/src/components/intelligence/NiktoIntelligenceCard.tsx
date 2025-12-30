import React from 'react';
import { AlertTriangle, Shield, Globe, Zap, Info } from 'lucide-react';

interface NiktoIntelligence {
  title: string;
  uri: string;
  method: string;
  osvdb: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  riskScore: number;
  securityImplications: string[];
  attackScenarios: string[];
  remediationSteps: string[];
  technicalDetails: {
    uri: string;
    method: string;
    osvdb: string;
    serverInfo: string;
    targetIP: string;
    targetPort: number;
  };
  businessImpact: string[];
  cvss: number;
  verified: boolean;
}

interface NiktoIntelligenceCardProps {
  finding: NiktoIntelligence;
}

export const NiktoIntelligenceCard: React.FC<NiktoIntelligenceCardProps> = ({ finding }) => {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'border-red-600 bg-red-50 dark:bg-red-900/20';
      case 'HIGH': return 'border-orange-500 bg-orange-50 dark:bg-orange-900/20';
      case 'MEDIUM': return 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20';
      case 'LOW': return 'border-blue-500 bg-blue-50 dark:bg-blue-900/20';
      default: return 'border-gray-300 bg-gray-50 dark:bg-gray-800';
    }
  };

  const getSeverityTextColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'text-red-900 dark:text-red-100';
      case 'HIGH': return 'text-orange-900 dark:text-orange-100';
      case 'MEDIUM': return 'text-yellow-900 dark:text-yellow-100';
      case 'LOW': return 'text-blue-900 dark:text-blue-100';
      default: return 'text-gray-900 dark:text-gray-100';
    }
  };

  const getSeverityBadgeClass = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'bg-red-600 text-white';
      case 'HIGH': return 'bg-orange-600 text-white';
      case 'MEDIUM': return 'bg-yellow-600 text-white';
      case 'LOW': return 'bg-blue-600 text-white';
      default: return 'bg-gray-600 text-white';
    }
  };

  return (
    <div className={`border-2 rounded-lg p-5 space-y-4 shadow-md transition-all hover:shadow-lg ${getSeverityColor(finding.severity)}`}>
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <Globe className="w-6 h-6 text-purple-600" />
            <h3 className={`text-lg font-bold ${getSeverityTextColor(finding.severity)}`}>
              {finding.title}
            </h3>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <code className={`px-2 py-1 rounded bg-white dark:bg-gray-800 text-sm font-semibold ${getSeverityTextColor(finding.severity)}`}>
              {finding.method} {finding.uri}
            </code>
          </div>
          {finding.osvdb && finding.osvdb !== 'N/A' && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">OSVDB:</span>
              <span className="text-xs text-gray-600 dark:text-gray-400">{finding.osvdb}</span>
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${getSeverityBadgeClass(finding.severity)}`}>
            {finding.severity}
          </span>
          <div className="text-right">
            <div className="text-2xl font-bold text-red-600">{finding.riskScore}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Risk Score</div>
          </div>
          <div className="text-right">
            <div className="text-lg font-semibold text-purple-600">{finding.cvss.toFixed(1)}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">CVSS</div>
          </div>
        </div>
      </div>

      {/* Technical Details */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 space-y-2">
        <div className="flex items-center gap-2 mb-3">
          <Info className="w-5 h-5 text-blue-600" />
          <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Technical Details</h4>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="font-medium text-gray-700 dark:text-gray-300">Server:</span>
            <span className="ml-2 text-gray-900 dark:text-gray-100">{finding.technicalDetails.serverInfo}</span>
          </div>
          <div>
            <span className="font-medium text-gray-700 dark:text-gray-300">Target IP:</span>
            <span className="ml-2 text-gray-900 dark:text-gray-100">{finding.technicalDetails.targetIP}</span>
          </div>
          <div>
            <span className="font-medium text-gray-700 dark:text-gray-300">Port:</span>
            <span className="ml-2 text-gray-900 dark:text-gray-100">{finding.technicalDetails.targetPort}</span>
          </div>
          <div>
            <span className="font-medium text-gray-700 dark:text-gray-300">Method:</span>
            <span className="ml-2 text-gray-900 dark:text-gray-100">{finding.technicalDetails.method}</span>
          </div>
        </div>
      </div>

      {/* Security Implications */}
      {finding.securityImplications && finding.securityImplications.length > 0 && (
        <div className="bg-red-100 dark:bg-red-900/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-5 h-5 text-red-700 dark:text-red-300" />
            <h4 className="text-sm font-semibold text-red-900 dark:text-red-100">Security Implications</h4>
          </div>
          <ul className="list-disc list-inside text-sm text-red-800 dark:text-red-200 space-y-1 ml-2">
            {finding.securityImplications.map((implication, idx) => (
              <li key={idx}>{implication}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Attack Scenarios */}
      {finding.attackScenarios && finding.attackScenarios.length > 0 && (
        <div className="bg-orange-100 dark:bg-orange-900/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-5 h-5 text-orange-700 dark:text-orange-300" />
            <h4 className="text-sm font-semibold text-orange-900 dark:text-orange-100">Potential Attack Scenarios</h4>
          </div>
          <ul className="list-disc list-inside text-sm text-orange-800 dark:text-orange-200 space-y-1 ml-2">
            {finding.attackScenarios.map((scenario, idx) => (
              <li key={idx}>{scenario}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Business Impact */}
      {finding.businessImpact && finding.businessImpact.length > 0 && (
        <div className="bg-purple-100 dark:bg-purple-900/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-purple-700 dark:text-purple-300" />
            <h4 className="text-sm font-semibold text-purple-900 dark:text-purple-100">Business Impact</h4>
          </div>
          <ul className="list-disc list-inside text-sm text-purple-800 dark:text-purple-200 space-y-1 ml-2">
            {finding.businessImpact.map((impact, idx) => (
              <li key={idx}>{impact}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Remediation Steps */}
      {finding.remediationSteps && finding.remediationSteps.length > 0 && (
        <div className="bg-green-100 dark:bg-green-900/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-5 h-5 text-green-700 dark:text-green-300" />
            <h4 className="text-sm font-semibold text-green-900 dark:text-green-100">Remediation Steps</h4>
          </div>
          <ol className="list-decimal list-inside text-sm text-green-800 dark:text-green-200 space-y-1 ml-2">
            {finding.remediationSteps.map((step, idx) => (
              <li key={idx}>{step}</li>
            ))}
          </ol>
        </div>
      )}

      {/* Status Indicators */}
      <div className="flex gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
        {finding.verified && (
          <span className="px-3 py-1 bg-blue-200 text-blue-800 dark:bg-blue-800 dark:text-blue-100 rounded-full text-xs font-semibold">
            ✓ Verified by Nikto
          </span>
        )}
        <span className="px-3 py-1 bg-purple-200 text-purple-800 dark:bg-purple-800 dark:text-purple-100 rounded-full text-xs font-semibold">
          🌐 Web Server Scan
        </span>
      </div>
    </div>
  );
};
