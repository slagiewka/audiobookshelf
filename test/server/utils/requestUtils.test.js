const assert = require('node:assert/strict')
const { describe, it } = require('node:test')

const { isRequestSecure, getRequestProtocol, getRequestOrigin } = require('../../../server/utils/requestUtils')

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

describe('requestUtils', () => {
  it('isRequestSecure uses req.secure', () => {
    assert.strictEqual(isRequestSecure(mockReq({ secure: true })), true)
    assert.strictEqual(isRequestSecure(mockReq({ secure: false })), false)
  })

  it('isRequestSecure uses x-forwarded-proto', () => {
    assert.strictEqual(isRequestSecure(mockReq({ xForwardedProto: 'https' })), true)
    assert.strictEqual(isRequestSecure(mockReq({ xForwardedProto: 'http' })), false)
    assert.strictEqual(isRequestSecure(mockReq({ xForwardedProto: 'http, https' })), true)
  })

  it('getRequestProtocol returns https or http', () => {
    assert.strictEqual(getRequestProtocol(mockReq({ secure: true })), 'https')
    assert.strictEqual(getRequestProtocol(mockReq()), 'http')
  })

  it('getRequestOrigin builds origin from protocol and host', () => {
    assert.deepStrictEqual(getRequestOrigin(mockReq({ secure: true })), {
      protocol: 'https',
      host: 'books.example.com',
      origin: 'https://books.example.com'
    })
  })
})
