import ReportViewer from "./ReportViewer";

const ReportCardPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-zinc-950 to-black p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent mb-2">
            Security Reports
          </h1>
          <p className="text-gray-400 text-sm">
            View and analyze your security scan results and vulnerability reports
          </p>
        </div>
        
        <ReportViewer />
      </div>
    </div>
  );
};

export default ReportCardPage;
