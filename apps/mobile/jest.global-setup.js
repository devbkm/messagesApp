// Runs in the parent process before test workers start, so they inherit a fixed
// time zone. (Setting TZ inside a worker has no effect on Windows.)
module.exports = () => {
  process.env.TZ = 'UTC';
};
