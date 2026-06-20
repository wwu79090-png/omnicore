export default function isTransientBenchmarkPageError(error) {
  return /Execution context was destroyed|Cannot find context with specified id|most likely because of a navigation|Failed to fetch dynamically imported module/i
    .test(String(error?.message || error));
}
