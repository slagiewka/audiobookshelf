const assert = require('node:assert/strict')
const { describe, it, beforeEach } = require('node:test')
// Import dependencies and modules for testing
const sinon = require('sinon')
const { LRUCache } = require('lru-cache')
const ApiCacheManager = require('../../../server/managers/ApiCacheManager')

describe('ApiCacheManager', () => {
  let cache
  let req
  let res
  let next
  let manager

  beforeEach(() => {
    cache = { get: sinon.stub(), set: sinon.spy() }
    req = { user: { username: 'testUser' }, url: '/test-url', query: {} }
    res = { send: sinon.spy(), getHeaders: sinon.stub(), statusCode: 200, status: sinon.spy(), set: sinon.spy() }
    next = sinon.spy()
  })

  describe('middleware', () => {
    it('should send cached data if available', () => {
      // Arrange
      const cachedData = { body: 'cached data', headers: { 'content-type': 'application/json' }, statusCode: 200 }
      cache.get.returns(cachedData)
      const key = JSON.stringify({ user: req.user.username, url: req.url })
      manager = new ApiCacheManager(cache)

      // Act
      manager.middleware(req, res, next)

      // Assert
      assert.strictEqual(cache.get.calledOnce, true)
      assert.strictEqual(cache.get.calledWith(key), true)
      assert.strictEqual(res.set.calledOnce, true)
      assert.strictEqual(res.set.calledWith(cachedData.headers), true)
      assert.strictEqual(res.status.calledOnce, true)
      assert.strictEqual(res.status.calledWith(cachedData.statusCode), true)
      assert.strictEqual(res.send.calledOnce, true)
      assert.strictEqual(res.send.calledWith(cachedData.body), true)
      assert.strictEqual(res.originalSend, undefined)
      assert.strictEqual(next.called, false)
      assert.strictEqual(cache.set.called, false)
    })

    it('should cache and send response if data is not cached', () => {
      // Arrange
      cache.get.returns(null)
      const headers = { 'content-type': 'application/json' }
      res.getHeaders.returns(headers)
      const body = 'response data'
      const statusCode = 200
      const responseData = { body, headers, statusCode }
      const key = JSON.stringify({ user: req.user.username, url: req.url })
      manager = new ApiCacheManager(cache)

      // Act
      manager.middleware(req, res, next)
      res.send(body)

      // Assert
      assert.strictEqual(cache.get.calledOnce, true)
      assert.strictEqual(cache.get.calledWith(key), true)
      assert.strictEqual(next.calledOnce, true)
      assert.strictEqual(cache.set.calledOnce, true)
      assert.strictEqual(cache.set.calledWith(key, responseData), true)
      assert.strictEqual(res.originalSend.calledOnce, true)
      assert.strictEqual(res.originalSend.calledWith(body), true)
    })

    it('should cache personalized response with 30 minutes TTL', () => {
      // Arrange
      cache.get.returns(null)
      const headers = { 'content-type': 'application/json' }
      res.getHeaders.returns(headers)
      const body = 'personalized data'
      const statusCode = 200
      const responseData = { body, headers, statusCode }
      req.url = '/libraries/id/personalized'
      const key = JSON.stringify({ user: req.user.username, url: req.url })
      const ttlOptions = { ttl: 30 * 60 * 1000 }
      manager = new ApiCacheManager(cache, ttlOptions)

      // Act
      manager.middleware(req, res, next)
      res.send(body)

      // Assert
      assert.strictEqual(cache.get.calledOnce, true)
      assert.strictEqual(cache.get.calledWith(key), true)
      assert.strictEqual(next.calledOnce, true)
      assert.strictEqual(cache.set.calledOnce, true)
      assert.strictEqual(cache.set.calledWith(key, responseData, ttlOptions), true)
      assert.strictEqual(res.originalSend.calledOnce, true)
      assert.strictEqual(res.originalSend.calledWith(body), true)
    })
  })

  describe('clear on mediaProgress', () => {
    it('should remove recent-episodes cache entries', () => {
      const key = JSON.stringify({ user: 'u', url: '/libraries/abc-123/recent-episodes?limit=50&page=0' })
      const cache = new LRUCache({ max: 10 })
      cache.set(key, { body: '[]', headers: {}, statusCode: 200 })
      const manager = new ApiCacheManager(cache)

      manager.clear({ name: 'mediaProgress' }, 'afterUpdate')

      assert.strictEqual(cache.get(key), undefined)
    })
  })
})
