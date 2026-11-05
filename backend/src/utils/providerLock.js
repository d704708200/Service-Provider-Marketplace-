/**
 * Strict FIFO Async Mutex Queue per Provider
 * 
 * Ensures that all concurrent operations attempting to book, accept, or reschedule
 * a slot for the same provider run in strict serialized order within the process.
 * 
 * Works in tandem with MongoDB ProviderSlotReservation unique indexes to guarantee
 * 100% atomic concurrency safety across both single and multi-instance environments.
 */

const providerQueues = new Map();

/**
 * Execute an async task with mutual exclusion for a specific provider.
 * If providerId is null or undefined (e.g. unassigned instant pool), executes task immediately.
 * 
 * @param {string|mongoose.Types.ObjectId} providerId 
 * @param {Function} taskFn Async function to run
 * @returns {Promise<any>} Result of taskFn
 */
const withProviderLock = async (providerId, taskFn) => {
  if (!providerId) {
    return await taskFn();
  }

  const key = providerId.toString();

  // Retrieve existing queue tail promise or start resolved
  const prevQueuePromise = providerQueues.get(key) || Promise.resolve();

  let resolveTicket;
  const currentTicket = new Promise((resolve) => {
    resolveTicket = resolve;
  });

  // Chain new ticket to the tail of the provider queue
  providerQueues.set(
    key,
    prevQueuePromise.then(() => currentTicket).catch(() => currentTicket)
  );

  // Wait strictly until all preceding operations for this provider have completed
  await prevQueuePromise;

  try {
    return await taskFn();
  } finally {
    resolveTicket();
    // Clean up map entry if this request is still the tail of the queue
    if (providerQueues.get(key) === currentTicket) {
      providerQueues.delete(key);
    }
  }
};

module.exports = {
  withProviderLock
};
