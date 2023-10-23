// Define a constant for the maximum cache size
const MAX_CACHE_SIZE = 20;

// Define a LRUCache class
class LRUCache {
  constructor() {
    // Initialize a cache using a Map and maintain access order with an array
    this.cache = new Map();
    this.accessOrder = [];
  }

  async getAsync(key) {
    if (this.cache.has(key)) {
      // Check if the key exists in the cache
      // Update the access order by moving the accessed key to the front
      this.accessOrder = this.accessOrder.filter(item => item !== key);
      this.accessOrder.unshift(key);
      return this.cache.get(key);
    }
    return null;
  }

  async setAsync(key, value) {
    if (this.cache.size >= MAX_CACHE_SIZE) {
      // Check if the cache size has reached the maximum
      // Remove the least recently used item by popping from the access order
      const lruKey = this.accessOrder.pop();
      this.cache.delete(lruKey);
    }
    // Set the key-value pair in the cache and make it the most recently used
    this.cache.set(key, value);
    this.accessOrder.unshift(key);
  }
}

// Export the LRUCache class
export default LRUCache;