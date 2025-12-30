import React from 'react';
import { Shield, AlertTriangle, Info, CheckCircle, Target } from 'lucide-react';
import { getRiskColor, getRiskBgColor } from '@/lib/colors';

interface Vulnerability {
  cve: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  exploitAvailable: boolean;
}

interface PortIntelligence {
  port: number;
  protocol?: string;
  service: string;
  version?: string;
  state?: string;
  vulnerabilities: Vulnerability[];
  commonIssues: string[];
  attackVectors: string[];
  remediationSteps: string[];
  riskScore: number;
}

interface PortIntelligenceCardProps {
  port: PortIntelligence;
}

export const PortIntelligenceCard: React.FC<PortIntelligenceCardProps> = ({ port }) => {
  const riskColor = getRiskColor(port.riskScore);
  const riskBgColor = getRiskBgColor(port.riskScore);

  const getSeverityBadgeClass = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-200 text-red-800 border-red-300';
      case 'high': return 'bg-orange-200 text-orange-800 border-orange-300';
      case 'medium': return 'bg-yellow-200 text-yellow-800 border-yellow-300';
      case 'low': return 'bg-green-200 text-green-800 border-green-300';
      default: return 'bg-gray-200 text-gray-800 border-gray-300';
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 space-y-4 bg-white shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" />
            <span>Port {port.port}</span>
            <span className="text-sm font-normal text-gray-500">
              ({port.protocol || 'tcp'})
            </span>
          </h3>
          <div className="mt-1 flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-700">
              {port.service}
            </span>
            {port.version && (
              <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200">
                v{port.version}
              </span>
            )}
            {port.state && (
              <span className="text-xs px-2 py-0.5 bg-green-50 text-green-700 rounded border border-green-200">
                {port.state}
              </span>
            )}
          </div>
        </div>
        <div 
          className="px-3 py-1 rounded-full font-semibold text-sm border-2"
          style={{ 
            color: riskColor, 
            backgroundColor: riskBgColor,
            borderColor: riskColor
          }}
        >
          Risk: {port.riskScore}/100
        </div>
      </div>

      {/* Vulnerabilities Section */}
      {port.vulnerabilities && port.vulnerabilities.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-4 h-4" />
            Known Vulnerabilities ({port.vulnerabilities.length})
          </h4>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {port.vulnerabilities.slice(0, 5).map((vuln, idx) => (
              <div 
                key={idx} 
                className="bg-red-50 border-l-4 border-red-500 p-3 text-sm rounded-r"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono font-semibold text-red-900">
                    {vuln.cve}
                  </span>
                  <div className="flex gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getSeverityBadgeClass(vuln.severity)}`}>
                      {vuln.severity.toUpperCase()}
                    </span>
                    {vuln.exploitAvailable && (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-200 text-purple-800 border border-purple-300">
                        EXPLOIT AVAILABLE
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-gray-700 text-xs">{vuln.description}</p>
              </div>
            ))}
          </div>
          {port.vulnerabilities.length > 5 && (
            <p className="text-xs text-gray-500 italic">
              + {port.vulnerabilities.length - 5} more vulnerabilities
            </p>
          )}
        </div>
      )}

      {/* Two-column layout for Issues and Remediation */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Common Issues */}
        {port.commonIssues && port.commonIssues.length > 0 && (
          <div>
            <h4 className="font-medium flex items-center gap-2 text-orange-600 mb-2">
              <Info className="w-4 h-4" />
              Common Issues
            </h4>
            <ul className="text-sm space-y-1">
              {port.commonIssues.map((issue, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-orange-500 mt-0.5">•</span>
                  <span className="text-gray-700">{issue}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Remediation Steps */}
        {port.remediationSteps && port.remediationSteps.length > 0 && (
          <div>
            <h4 className="font-medium flex items-center gap-2 text-blue-600 mb-2">
              <CheckCircle className="w-4 h-4" />
              Remediation Steps
            </h4>
            <ul className="text-sm space-y-1">
              {port.remediationSteps.map((step, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5">✓</span>
                  <span className="text-gray-700">{step}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Attack Vectors */}
      {port.attackVectors && port.attackVectors.length > 0 && (
        <div className="bg-gray-50 p-3 rounded border border-gray-200">
          <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
            <Target className="w-4 h-4 text-gray-600" />
            Potential Attack Vectors:
          </h4>
          <div className="flex flex-wrap gap-2">
            {port.attackVectors.map((vector, idx) => (
              <span 
                key={idx} 
                className="px-2 py-1 bg-white text-gray-700 text-xs rounded border border-gray-300 font-medium"
              >
                {vector}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PortIntelligenceCard;
