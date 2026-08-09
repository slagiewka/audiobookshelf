const assert = require('node:assert/strict')
const { describe, it, beforeEach, afterEach } = require('node:test')
const sinon = require('sinon')

const UserController = require('../../../server/controllers/UserController')
const Logger = require('../../../server/Logger')

describe('UserController - delete', () => {
  beforeEach(() => {
    sinon.stub(Logger, 'error')
  })

  afterEach(() => {
    sinon.restore()
  })

  it('rejects deleting the root user by UUID', async () => {
    const rootUser = { id: 'root-uuid', isRoot: true, username: 'root' }
    const adminUser = { id: 'admin-uuid', isRoot: false, username: 'admin' }
    const fakeRes = { sendStatus: sinon.spy(), json: sinon.spy() }

    await UserController.delete({ user: adminUser, reqUser: rootUser, params: { id: rootUser.id } }, fakeRes)

    assert.strictEqual(fakeRes.sendStatus.calledWith(403), true)
    assert.strictEqual(fakeRes.json.called, false)
  })
})
