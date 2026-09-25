// Runs in the main process before test workers start, so they inherit a fixed time
// zone for deterministic date formatting. (Setting TZ inside a worker has no effect
// on Windows.)
export default function setup() {
  process.env.TZ = 'UTC'
}
