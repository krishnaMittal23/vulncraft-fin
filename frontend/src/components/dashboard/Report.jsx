import ReportViewer from "./ReportViewer";

const ReportCardPage = () => {
  return (
    <div
      className="min-h-screen bg-[#09090b] p-6 sm:p-8"
      style={{ fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif" }}
    >
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-[#e5e1e4] mb-2">
            Security Reports
          </h1>
          <p className="text-[#bccbb9] text-sm max-w-2xl">
            Scan results and vulnerability findings. Monitor the security health
            of your infrastructure across all connected environments.
          </p>
        </div>

        <ReportViewer />
      </div>
    </div>
  );
};

export default ReportCardPage;
