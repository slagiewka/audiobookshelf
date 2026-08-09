const assert = require('node:assert/strict')
const { describe, it, beforeEach } = require('node:test')
const sinon = require('sinon')

const { DataTypes } = require('sequelize')

const { up, down } = require('../../../server/migrations/v2.17.6-share-add-isdownloadable')

describe('Migration v2.17.6-share-add-isDownloadable', () => {
  let queryInterface, logger

  beforeEach(() => {
    queryInterface = {
      addColumn: sinon.stub().resolves(),
      removeColumn: sinon.stub().resolves(),
      tableExists: sinon.stub().resolves(true),
      describeTable: sinon.stub().resolves({ isDownloadable: undefined }),
      sequelize: {
        Sequelize: {
          DataTypes: {
            BOOLEAN: DataTypes.BOOLEAN
          }
        }
      }
    }

    logger = {
      info: sinon.stub(),
      error: sinon.stub()
    }
  })

  describe('up', () => {
    it('should add the isDownloadable column to mediaItemShares table', async () => {
      await up({ context: { queryInterface, logger } })

      assert.strictEqual(queryInterface.addColumn.calledOnce, true)
      assert.strictEqual(
        queryInterface.addColumn.calledWith('mediaItemShares', 'isDownloadable', {
          type: DataTypes.BOOLEAN,
          defaultValue: false,
          allowNull: false
        })
      , true)

      assert.strictEqual(logger.info.calledWith('[2.17.6 migration] UPGRADE BEGIN: 2.17.6-share-add-isdownloadable'), true)
      assert.strictEqual(logger.info.calledWith('[2.17.6 migration] Adding isDownloadable column to mediaItemShares table'), true)
      assert.strictEqual(logger.info.calledWith('[2.17.6 migration] Added isDownloadable column to mediaItemShares table'), true)
      assert.strictEqual(logger.info.calledWith('[2.17.6 migration] UPGRADE END: 2.17.6-share-add-isdownloadable'), true)
    })
  })

  describe('down', () => {
    it('should remove the isDownloadable column from mediaItemShares table', async () => {
      queryInterface.describeTable.resolves({ isDownloadable: true })

      await down({ context: { queryInterface, logger } })

      assert.strictEqual(queryInterface.removeColumn.calledOnce, true)
      assert.strictEqual(queryInterface.removeColumn.calledWith('mediaItemShares', 'isDownloadable'), true)

      assert.strictEqual(logger.info.calledWith('[2.17.6 migration] DOWNGRADE BEGIN: 2.17.6-share-add-isdownloadable'), true)
      assert.strictEqual(logger.info.calledWith('[2.17.6 migration] Removing isDownloadable column from mediaItemShares table'), true)
      assert.strictEqual(logger.info.calledWith('[2.17.6 migration] Removed isDownloadable column from mediaItemShares table'), true)
      assert.strictEqual(logger.info.calledWith('[2.17.6 migration] DOWNGRADE END: 2.17.6-share-add-isdownloadable'), true)
    })
  })
})
