export default function DashboardLoading() {
  return (
    <div className="page-content space-y-4">
      <div className="skeleton h-8 w-48 rounded-lg" />
      <div className="skeleton h-4 w-64 rounded-lg" />
      <div className="card p-6 space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="skeleton h-12 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
