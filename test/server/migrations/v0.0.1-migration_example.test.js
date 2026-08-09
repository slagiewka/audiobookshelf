const assert = require('node:assert/strict')
const { describe, it, beforeEach, afterEach } = require('node:test')
const sinon = require('sinon')
const { up, down } = require('./v0.0.1-migration_example')
const { Sequelize } = require('sequelize')
const Logger = require('../../../server/Logger')

describe('migration_example', () => {
  let sequelize
  let queryInterface
  let loggerInfoStub

  beforeEach(() => {
    sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    queryInterface = sequelize.getQueryInterface()
    loggerInfoStub = sinon.stub(Logger, 'info')
  })

  afterEach(() => {
    sinon.restore()
  })

  describe('up', () => {
    it('should create example_table', async () => {
      await up({ context: { queryInterface, logger: Logger } })

      assert.strictEqual(loggerInfoStub.callCount, 4)
      assert.strictEqual(loggerInfoStub.getCall(0).calledWith(sinon.match('Running migration_example up...')), true)
      assert.strictEqual(loggerInfoStub.getCall(1).calledWith(sinon.match('Creating example_table...')), true)
      assert.strictEqual(loggerInfoStub.getCall(2).calledWith(sinon.match('example_table created.')), true)
      assert.strictEqual(loggerInfoStub.getCall(3).calledWith(sinon.match('migration_example up complete.')), true)
      assert.ok((await queryInterface.showAllTables()).some((table) => table === 'example_table' || table.tableName === 'example_table'))
      const tableDescription = await queryInterface.describeTable('example_table')
      assert.deepStrictEqual(tableDescription, {
        id: { type: 'INTEGER', allowNull: true, defaultValue: undefined, primaryKey: true, unique: false },
        name: { type: 'VARCHAR(255)', allowNull: false, defaultValue: undefined, primaryKey: false, unique: false }
      })
    })
  })

  describe('down', () => {
    it('should drop example_table', async () => {
      await up({ context: { queryInterface, logger: Logger } })
      await down({ context: { queryInterface, logger: Logger } })

      assert.strictEqual(loggerInfoStub.callCount, 8)
      assert.strictEqual(loggerInfoStub.getCall(4).calledWith(sinon.match('Running migration_example down...')), true)
      assert.strictEqual(loggerInfoStub.getCall(5).calledWith(sinon.match('Dropping example_table...')), true)
      assert.strictEqual(loggerInfoStub.getCall(6).calledWith(sinon.match('example_table dropped.')), true)
      assert.strictEqual(loggerInfoStub.getCall(7).calledWith(sinon.match('migration_example down complete.')), true)
      assert.ok(!(await queryInterface.showAllTables()).some((table) => table === 'example_table' || table.tableName === 'example_table'))
    })
  })
})
