const assert = require('node:assert/strict')
const { describe, it, beforeEach, afterEach } = require('node:test')
const sinon = require('sinon')
const { Op } = require('sequelize')

const Database = require('../../../server/Database')
const jwt = require('../../../server/libs/jsonwebtoken')

// Database → Auth → TokenManager circular require can leave TokenManager with a partial Database reference; reload before each test
function loadTokenManager() {
  delete require.cache[require.resolve('../../../server/auth/TokenManager')]
  return require('../../../server/auth/TokenManager')
}

describe('TokenManager', () => {
  const secret = 'test-jwt-secret'
  const userId = 'user-uuid-1'
  let TokenManager
  let tokenManager

  beforeEach(() => {
    TokenManager = loadTokenManager()
    TokenManager.TokenSecret = secret
    tokenManager = new TokenManager()
  })

  afterEach(() => {
    sinon.restore()
  })

  describe('validateAccessToken', () => {
    it('rejects refresh tokens', () => {
      const refreshToken = jwt.sign({ userId, type: 'refresh' }, secret, { expiresIn: 3600 })
      assert.strictEqual(TokenManager.validateAccessToken(refreshToken), null)
    })

    it('accepts access tokens', () => {
      const accessToken = jwt.sign({ userId, type: 'access' }, secret, { expiresIn: 3600 })
      const decoded = TokenManager.validateAccessToken(accessToken)
      assert.strictEqual(decoded.userId, userId)
      assert.strictEqual(decoded.type, 'access')
    })
  })

  describe('jwtAuthCheck', () => {
    const user = { id: userId, username: 'testuser', isActive: true }

    it('rejects refresh tokens for API auth', async () => {
      const refreshToken = tokenManager.generateRefreshToken(user)
      const decoded = jwt.verify(refreshToken, secret)
      const done = sinon.spy()

      await tokenManager.jwtAuthCheck(decoded, done)

      assert.strictEqual(done.calledWith(null, null), true)
    })

    it('allows access tokens for active users', async () => {
      sinon.stub(Database, 'userModel').get(() => ({
        getUserByIdOrOldId: sinon.stub().resolves(user)
      }))
      const decoded = jwt.verify(tokenManager.generateTempAccessToken(user), secret)
      const done = sinon.spy()

      await tokenManager.jwtAuthCheck(decoded, done)

      assert.strictEqual(done.calledWith(null, user), true)
    })
  })

  describe('invalidateJwtSessionsForUser', () => {
    const targetUser = { id: userId, username: 'testuser' }
    const currentSession = {
      id: 'session-current',
      userId,
      refreshToken: 'refresh-current'
    }

    /** Minimal req/res for session invalidation (ApiRouter provides auth on real requests). */
    function makeReq({ requestUserId = userId, refreshToken = null, cookieRefreshToken = null } = {}) {
      return {
        user: { id: requestUserId },
        cookies: cookieRefreshToken ? { refresh_token: cookieRefreshToken } : {},
        headers: refreshToken ? { 'x-refresh-token': refreshToken } : {}
      }
    }

    let sessionFindOne
    let sessionDestroy
    let rotateStub

    beforeEach(() => {
      sessionFindOne = sinon.stub().resolves(currentSession)
      sessionDestroy = sinon.stub().resolves(1)
      sinon.stub(Database, 'sessionModel').get(() => ({
        findOne: sessionFindOne,
        destroy: sessionDestroy
      }))
      rotateStub = sinon.stub(tokenManager, 'rotateTokensForSession').resolves({
        accessToken: 'access-new',
        refreshToken: 'refresh-new'
      })
    })

    it('self password change: keeps current session, deletes others', async () => {
      const req = makeReq({ refreshToken: 'refresh-current' })
      const res = { cookie: sinon.spy() }

      const result = await tokenManager.invalidateJwtSessionsForUser(targetUser, req, res)

      // Found this device's session using the x-refresh-token header
      assert.strictEqual(sessionFindOne.calledOnce, true)
      const findWhere = sessionFindOne.firstCall.args[0].where
      assert.strictEqual(findWhere.userId, userId)
      assert.deepStrictEqual(findWhere[Op.or], [{ refreshToken: 'refresh-current' }, { lastRefreshToken: 'refresh-current' }])

      // Rotated in place (no grace period) so the caller keeps a valid session
      assert.strictEqual(rotateStub.calledOnceWith(currentSession, targetUser, req, res, false), true)

      // Deleted all other sessions, but not this one
      assert.strictEqual(sessionDestroy.calledOnce, true)
      const destroyWhere = sessionDestroy.firstCall.args[0].where
      assert.strictEqual(destroyWhere.userId, userId)
      assert.strictEqual(destroyWhere.id[Op.ne], currentSession.id)

      assert.deepStrictEqual(result, { accessToken: 'access-new', refreshToken: 'refresh-new' })
    })

    it('admin password reset: deletes all target sessions', async () => {
      const req = makeReq({ requestUserId: 'admin-id', refreshToken: 'refresh-current' })
      const res = { cookie: sinon.spy() }

      const result = await tokenManager.invalidateJwtSessionsForUser(targetUser, req, res)

      // Token rotation did not happen because target is a different user
      assert.strictEqual(sessionFindOne.called, false)
      assert.strictEqual(rotateStub.called, false)

      assert.strictEqual(sessionDestroy.calledOnceWith(sinon.match({ where: { userId } })), true)
      assert.strictEqual(result, null)
    })
  })
})
