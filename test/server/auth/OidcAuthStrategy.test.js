const assert = require('node:assert/strict')
const { describe, it, beforeEach, afterEach } = require('node:test')
const sinon = require('sinon')

// Load Database first so Auth resolves OidcAuthStrategy before the circular require completes.
require('../../../server/Database')
const OidcAuthStrategy = require('../../../server/auth/OidcAuthStrategy')
const Logger = require('../../../server/Logger')

describe('OidcAuthStrategy - isValidWebCallbackUrl', () => {
  /** @type {OidcAuthStrategy} */
  let strategy

  beforeEach(() => {
    global.RouterBasePath = ''
    strategy = new OidcAuthStrategy()
    sinon.stub(Logger, 'warn')
    sinon.stub(Logger, 'error')
  })

  afterEach(() => {
    sinon.restore()
  })

  function mockReq({ secure = false, host = 'books.example.com', xForwardedProto = null } = {}) {
    return {
      secure,
      get(header) {
        if (header === 'host') return host
        if (header === 'x-forwarded-proto') return xForwardedProto
        return null
      }
    }
  }

  it('accepts a same-origin relative path when router base path is empty', () => {
    assert.strictEqual(strategy.isValidWebCallbackUrl('/library', mockReq()), true)
  })

  it('accepts a same-origin absolute https URL', () => {
    const req = mockReq({ secure: true })
    assert.strictEqual(strategy.isValidWebCallbackUrl('https://books.example.com/library', req), true)
  })

  it('rejects protocol-relative URLs', () => {
    assert.strictEqual(strategy.isValidWebCallbackUrl('//evil.example/capture', mockReq()), false)
  })

  it('rejects backslash-prefixed URLs', () => {
    assert.strictEqual(strategy.isValidWebCallbackUrl('/\\evil.example/capture', mockReq()), false)
  })

  it('rejects absolute external URLs', () => {
    assert.strictEqual(strategy.isValidWebCallbackUrl('http://evil.example/capture', mockReq()), false)
  })

  it('rejects encoded protocol-relative path segments', () => {
    assert.strictEqual(strategy.isValidWebCallbackUrl('/%2F%2Fevil.example/capture', mockReq()), false)
  })

  it('rejects same-origin URLs outside router base path', () => {
    global.RouterBasePath = '/audiobookshelf'
    assert.strictEqual(strategy.isValidWebCallbackUrl('/login', mockReq()), false)
    assert.strictEqual(strategy.isValidWebCallbackUrl('/audiobookshelf/login', mockReq()), true)
  })

  it('rejects empty and malformed callback URLs', () => {
    assert.strictEqual(strategy.isValidWebCallbackUrl('', mockReq()), false)
    assert.strictEqual(strategy.isValidWebCallbackUrl(null, mockReq()), false)
    assert.strictEqual(strategy.isValidWebCallbackUrl('not a url', mockReq()), false)
  })

  it('uses x-forwarded-proto when determining same-origin https URLs', () => {
    const req = mockReq({ xForwardedProto: 'https' })
    assert.strictEqual(strategy.isValidWebCallbackUrl('https://books.example.com/login', req), true)
    assert.strictEqual(strategy.isValidWebCallbackUrl('http://books.example.com/login', req), false)
  })
})
