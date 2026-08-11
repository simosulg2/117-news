// Some restricted containers cannot read resident memory through libuv.
// Keep framework diagnostics from blocking an otherwise valid production build.
const originalMemoryUsage = process.memoryUsage;

function safeMemoryUsage() {
  try {
    return originalMemoryUsage();
  } catch {
    return { rss: 0, heapTotal: 0, heapUsed: 0, external: 0, arrayBuffers: 0 };
  }
}

safeMemoryUsage.rss = function safeRss() {
  try {
    return originalMemoryUsage.rss();
  } catch {
    return 0;
  }
};

process.memoryUsage = safeMemoryUsage;
