import { JobList } from "@/components/JobList";

export default function JobsPage() {
  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white">Active jobs</h2>
        <p className="mt-1 text-gray-500">
          Monitor snipes in real time. Logs refresh every 2 seconds.
        </p>
      </div>
      <JobList />
    </div>
  );
}
