import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Shield, Eye, Download } from "lucide-react";

interface OWASPVulnerability {
  title: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  risk: string;
  confidence: string;
  description: string;
  solution?: string;
  reference?: string;
  url?: string;
  owasp_category?: string;
  cwe_id?: string;
  instances?: number;
}

interface OWASPIntelligenceCardProps {
  vulnerability: OWASPVulnerability;
}

const OWASPIntelligenceCard = ({ vulnerability }: OWASPIntelligenceCardProps) => {
  const getSeverityColor = (severity: string) => {
    switch (severity?.toUpperCase()) {
      case 'CRITICAL':
        return 'bg-red-100 border-red-300 dark:bg-red-900/30 dark:border-red-700';
      case 'HIGH':
        return 'bg-orange-100 border-orange-300 dark:bg-orange-900/30 dark:border-orange-700';
      case 'MEDIUM':
        return 'bg-yellow-100 border-yellow-300 dark:bg-yellow-900/30 dark:border-yellow-700';
      default:
        return 'bg-blue-100 border-blue-300 dark:bg-blue-900/30 dark:border-blue-700';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity?.toUpperCase()) {
      case 'CRITICAL':
      case 'HIGH':
        return <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />;
      case 'MEDIUM':
        return <Eye className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />;
      default:
        return <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />;
    }
  };

  const getRiskBadgeVariant = (severity: string) => {
    switch (severity?.toUpperCase()) {
      case 'CRITICAL':
      case 'HIGH':
        return 'destructive';
      case 'MEDIUM':
        return 'default';
      default:
        return 'secondary';
    }
  };

  return (
    <Card className={`${getSeverityColor(vulnerability.severity)} transition-all hover:shadow-md`}>
      <CardContent className="pt-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-start gap-3 flex-1">
            {getSeverityIcon(vulnerability.severity)}
            <div className="flex-1">
              <h5 className="font-semibold text-gray-900 dark:text-gray-100 text-sm leading-tight">
                {vulnerability.title}
              </h5>
              {vulnerability.url && (
                <code className="text-xs text-gray-600 dark:text-gray-400 mt-1 block break-all">
                  {vulnerability.url.length > 60 
                    ? vulnerability.url.substring(0, 60) + '...' 
                    : vulnerability.url}
                </code>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-1 ml-2">
            <Badge variant={getRiskBadgeVariant(vulnerability.severity)} className="text-xs">
              {vulnerability.severity}
            </Badge>
            {vulnerability.instances && vulnerability.instances > 1 && (
              <Badge variant="outline" className="text-xs">
                {vulnerability.instances} instances
              </Badge>
            )}
          </div>
        </div>

        {/* Description */}
        <div className="mb-3">
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            {vulnerability.description.length > 200 
              ? vulnerability.description.substring(0, 200) + '...' 
              : vulnerability.description}
          </p>
        </div>

        {/* Metadata */}
        <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
          {vulnerability.risk && (
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900 dark:text-gray-100">Risk:</span>
              <span className="text-gray-700 dark:text-gray-300">{vulnerability.risk}</span>
            </div>
          )}
          {vulnerability.confidence && (
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900 dark:text-gray-100">Confidence:</span>
              <span className="text-gray-700 dark:text-gray-300">{vulnerability.confidence}</span>
            </div>
          )}
          {vulnerability.owasp_category && (
            <div className="flex items-center gap-2 col-span-2">
              <span className="font-medium text-gray-900 dark:text-gray-100">OWASP:</span>
              <Badge variant="outline" className="text-xs">
                {vulnerability.owasp_category}
              </Badge>
            </div>
          )}
          {vulnerability.cwe_id && (
            <div className="flex items-center gap-2 col-span-2">
              <span className="font-medium text-gray-900 dark:text-gray-100">CWE:</span>
              <Badge variant="outline" className="text-xs">
                {vulnerability.cwe_id}
              </Badge>
            </div>
          )}
        </div>

        {/* Solution */}
        {vulnerability.solution && (
          <div className="mb-3 p-3 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
            <h6 className="text-xs font-semibold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-1">
              <Shield className="h-3 w-3" />
              Solution
            </h6>
            <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
              {vulnerability.solution.length > 300 
                ? vulnerability.solution.substring(0, 300) + '...' 
                : vulnerability.solution}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            {vulnerability.reference && (
              <Button 
                variant="outline" 
                size="sm" 
                className="text-xs h-6"
                onClick={() => window.open(vulnerability.reference, '_blank')}
              >
                Reference
              </Button>
            )}
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-xs h-6"
            onClick={() => {
              const report = {
                title: vulnerability.title,
                severity: vulnerability.severity,
                description: vulnerability.description,
                solution: vulnerability.solution,
                url: vulnerability.url,
                owasp_category: vulnerability.owasp_category,
                cwe_id: vulnerability.cwe_id
              };
              const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `owasp-vulnerability-${Date.now()}.json`;
              a.click();
            }}
          >
            <Download className="h-3 w-3 mr-1" />
            Export
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default OWASPIntelligenceCard;