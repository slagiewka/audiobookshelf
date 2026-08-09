const assert = require('node:assert/strict')
const { describe, it, beforeEach, afterEach } = require('node:test')
const sinon = require('sinon')
const { up } = require('../../../server/migrations/v2.17.3-fk-constraints')
const { Sequelize, QueryInterface } = require('sequelize')
const Logger = require('../../../server/Logger')

describe('migration-v2.17.3-fk-constraints', () => {
  let sequelize
  /** @type {QueryInterface} */
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
    beforeEach(async () => {
      // Create associated tables: Users, libraries, libraryFolders, playlists, devices
      await queryInterface.sequelize.query('CREATE TABLE `users` (`id` UUID PRIMARY KEY);')
      await queryInterface.sequelize.query('CREATE TABLE `libraries` (`id` UUID PRIMARY KEY);')
      await queryInterface.sequelize.query('CREATE TABLE `libraryFolders` (`id` UUID PRIMARY KEY);')
      await queryInterface.sequelize.query('CREATE TABLE `playlists` (`id` UUID PRIMARY KEY);')
      await queryInterface.sequelize.query('CREATE TABLE `devices` (`id` UUID PRIMARY KEY);')
    })

    afterEach(async () => {
      await queryInterface.dropAllTables()
    })

    it('should fix table foreign key constraints', async () => {
      // Create tables with missing foreign key constraints: libraryItems, feeds, mediaItemShares, playbackSessions, playlistMediaItems, mediaProgresses
      await queryInterface.sequelize.query('CREATE TABLE `libraryItems` (`id` UUID UNIQUE PRIMARY KEY, `libraryId` UUID REFERENCES `libraries` (`id`), `libraryFolderId` UUID REFERENCES `libraryFolders` (`id`));')
      await queryInterface.sequelize.query('CREATE TABLE `feeds` (`id` UUID UNIQUE PRIMARY KEY, `userId` UUID REFERENCES `users` (`id`));')
      await queryInterface.sequelize.query('CREATE TABLE `mediaItemShares` (`id` UUID UNIQUE PRIMARY KEY, `userId` UUID REFERENCES `users` (`id`));')
      await queryInterface.sequelize.query('CREATE TABLE `playbackSessions` (`id` UUID UNIQUE PRIMARY KEY, `userId` UUID REFERENCES `users` (`id`), `deviceId` UUID REFERENCES `devices` (`id`), `libraryId` UUID REFERENCES `libraries` (`id`));')
      await queryInterface.sequelize.query('CREATE TABLE `playlistMediaItems` (`id` UUID UNIQUE PRIMARY KEY, `playlistId` UUID REFERENCES `playlists` (`id`));')
      await queryInterface.sequelize.query('CREATE TABLE `mediaProgresses` (`id` UUID UNIQUE PRIMARY KEY, `userId` UUID REFERENCES `users` (`id`));')

      //
      // Validate that foreign key constraints are missing
      //
      let libraryItemsForeignKeys = await queryInterface.sequelize.query(`PRAGMA foreign_key_list(libraryItems);`)
      assert.deepStrictEqual([...libraryItemsForeignKeys].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))), [...[
        { id: 0, seq: 0, table: 'libraryFolders', from: 'libraryFolderId', to: 'id', on_update: 'NO ACTION', on_delete: 'NO ACTION', match: 'NONE' },
        { id: 1, seq: 0, table: 'libraries', from: 'libraryId', to: 'id', on_update: 'NO ACTION', on_delete: 'NO ACTION', match: 'NONE' }
      ]].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))))

      let feedsForeignKeys = await queryInterface.sequelize.query(`PRAGMA foreign_key_list(feeds);`)
      assert.deepStrictEqual(feedsForeignKeys, [{ id: 0, seq: 0, table: 'users', from: 'userId', to: 'id', on_update: 'NO ACTION', on_delete: 'NO ACTION', match: 'NONE' }])

      let mediaItemSharesForeignKeys = await queryInterface.sequelize.query(`PRAGMA foreign_key_list(mediaItemShares);`)
      assert.deepStrictEqual(mediaItemSharesForeignKeys, [{ id: 0, seq: 0, table: 'users', from: 'userId', to: 'id', on_update: 'NO ACTION', on_delete: 'NO ACTION', match: 'NONE' }])

      let playbackSessionForeignKeys = await queryInterface.sequelize.query(`PRAGMA foreign_key_list(playbackSessions);`)
      assert.deepStrictEqual(playbackSessionForeignKeys, [
        { id: 0, seq: 0, table: 'libraries', from: 'libraryId', to: 'id', on_update: 'NO ACTION', on_delete: 'NO ACTION', match: 'NONE' },
        { id: 1, seq: 0, table: 'devices', from: 'deviceId', to: 'id', on_update: 'NO ACTION', on_delete: 'NO ACTION', match: 'NONE' },
        { id: 2, seq: 0, table: 'users', from: 'userId', to: 'id', on_update: 'NO ACTION', on_delete: 'NO ACTION', match: 'NONE' }
      ])

      let playlistMediaItemsForeignKeys = await queryInterface.sequelize.query(`PRAGMA foreign_key_list(playlistMediaItems);`)
      assert.deepStrictEqual(playlistMediaItemsForeignKeys, [{ id: 0, seq: 0, table: 'playlists', from: 'playlistId', to: 'id', on_update: 'NO ACTION', on_delete: 'NO ACTION', match: 'NONE' }])

      let mediaProgressesForeignKeys = await queryInterface.sequelize.query(`PRAGMA foreign_key_list(mediaProgresses);`)
      assert.deepStrictEqual(mediaProgressesForeignKeys, [{ id: 0, seq: 0, table: 'users', from: 'userId', to: 'id', on_update: 'NO ACTION', on_delete: 'NO ACTION', match: 'NONE' }])

      //
      // Insert test data into tables
      //
      await queryInterface.bulkInsert('users', [{ id: 'e1a96857-48a8-43b6-8966-abc909c55b0f' }])
      await queryInterface.bulkInsert('libraries', [{ id: 'a41a40e3-f516-40f5-810d-757ab668ebba' }])
      await queryInterface.bulkInsert('libraryFolders', [{ id: 'b41a40e3-f516-40f5-810d-757ab668ebba' }])
      await queryInterface.bulkInsert('playlists', [{ id: 'f41a40e3-f516-40f5-810d-757ab668ebba' }])
      await queryInterface.bulkInsert('devices', [{ id: 'g41a40e3-f516-40f5-810d-757ab668ebba' }])

      await queryInterface.bulkInsert('libraryItems', [{ id: 'c1a96857-48a8-43b6-8966-abc909c55b0f', libraryId: 'a41a40e3-f516-40f5-810d-757ab668ebba', libraryFolderId: 'b41a40e3-f516-40f5-810d-757ab668ebba' }])
      await queryInterface.bulkInsert('feeds', [{ id: 'd1a96857-48a8-43b6-8966-abc909c55b0f', userId: 'e1a96857-48a8-43b6-8966-abc909c55b0f' }])
      await queryInterface.bulkInsert('mediaItemShares', [{ id: 'h1a96857-48a8-43b6-8966-abc909c55b0f', userId: 'e1a96857-48a8-43b6-8966-abc909c55b0f' }])
      await queryInterface.bulkInsert('playbackSessions', [{ id: 'f1a96857-48a8-43b6-8966-abc909c55b0x', userId: 'e1a96857-48a8-43b6-8966-abc909c55b0f', deviceId: 'g41a40e3-f516-40f5-810d-757ab668ebba', libraryId: 'a41a40e3-f516-40f5-810d-757ab668ebba' }])
      await queryInterface.bulkInsert('playlistMediaItems', [{ id: 'i1a96857-48a8-43b6-8966-abc909c55b0f', playlistId: 'f41a40e3-f516-40f5-810d-757ab668ebba' }])
      await queryInterface.bulkInsert('mediaProgresses', [{ id: 'j1a96857-48a8-43b6-8966-abc909c55b0f', userId: 'e1a96857-48a8-43b6-8966-abc909c55b0f' }])

      //
      // Query data before migration
      //
      const libraryItems = await queryInterface.sequelize.query('SELECT * FROM libraryItems;')
      const feeds = await queryInterface.sequelize.query('SELECT * FROM feeds;')
      const mediaItemShares = await queryInterface.sequelize.query('SELECT * FROM mediaItemShares;')
      const playbackSessions = await queryInterface.sequelize.query('SELECT * FROM playbackSessions;')
      const playlistMediaItems = await queryInterface.sequelize.query('SELECT * FROM playlistMediaItems;')
      const mediaProgresses = await queryInterface.sequelize.query('SELECT * FROM mediaProgresses;')

      //
      // Run migration
      //
      await up({ context: { queryInterface, logger: Logger } })

      //
      // Validate that foreign key constraints are updated
      //
      libraryItemsForeignKeys = await queryInterface.sequelize.query(`PRAGMA foreign_key_list(libraryItems);`)
      assert.deepStrictEqual([...libraryItemsForeignKeys].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))), [...[
        { id: 0, seq: 0, table: 'libraryFolders', from: 'libraryFolderId', to: 'id', on_update: 'CASCADE', on_delete: 'SET NULL', match: 'NONE' },
        { id: 1, seq: 0, table: 'libraries', from: 'libraryId', to: 'id', on_update: 'CASCADE', on_delete: 'SET NULL', match: 'NONE' }
      ]].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))))

      feedsForeignKeys = await queryInterface.sequelize.query(`PRAGMA foreign_key_list(feeds);`)
      assert.deepStrictEqual(feedsForeignKeys, [{ id: 0, seq: 0, table: 'users', from: 'userId', to: 'id', on_update: 'CASCADE', on_delete: 'SET NULL', match: 'NONE' }])

      mediaItemSharesForeignKeys = await queryInterface.sequelize.query(`PRAGMA foreign_key_list(mediaItemShares);`)
      assert.deepStrictEqual(mediaItemSharesForeignKeys, [{ id: 0, seq: 0, table: 'users', from: 'userId', to: 'id', on_update: 'CASCADE', on_delete: 'SET NULL', match: 'NONE' }])

      playbackSessionForeignKeys = await queryInterface.sequelize.query(`PRAGMA foreign_key_list(playbackSessions);`)
      assert.deepStrictEqual(playbackSessionForeignKeys, [
        { id: 0, seq: 0, table: 'libraries', from: 'libraryId', to: 'id', on_update: 'CASCADE', on_delete: 'SET NULL', match: 'NONE' },
        { id: 1, seq: 0, table: 'devices', from: 'deviceId', to: 'id', on_update: 'CASCADE', on_delete: 'SET NULL', match: 'NONE' },
        { id: 2, seq: 0, table: 'users', from: 'userId', to: 'id', on_update: 'CASCADE', on_delete: 'SET NULL', match: 'NONE' }
      ])

      playlistMediaItemsForeignKeys = await queryInterface.sequelize.query(`PRAGMA foreign_key_list(playlistMediaItems);`)
      assert.deepStrictEqual(playlistMediaItemsForeignKeys, [{ id: 0, seq: 0, table: 'playlists', from: 'playlistId', to: 'id', on_update: 'CASCADE', on_delete: 'CASCADE', match: 'NONE' }])

      mediaProgressesForeignKeys = await queryInterface.sequelize.query(`PRAGMA foreign_key_list(mediaProgresses);`)
      assert.deepStrictEqual(mediaProgressesForeignKeys, [{ id: 0, seq: 0, table: 'users', from: 'userId', to: 'id', on_update: 'CASCADE', on_delete: 'CASCADE', match: 'NONE' }])

      //
      // Validate that data is not changed
      //
      const libraryItemsAfter = await queryInterface.sequelize.query('SELECT * FROM libraryItems;')
      assert.deepStrictEqual(libraryItemsAfter, libraryItems)

      const feedsAfter = await queryInterface.sequelize.query('SELECT * FROM feeds;')
      assert.deepStrictEqual(feedsAfter, feeds)

      const mediaItemSharesAfter = await queryInterface.sequelize.query('SELECT * FROM mediaItemShares;')
      assert.deepStrictEqual(mediaItemSharesAfter, mediaItemShares)

      const playbackSessionsAfter = await queryInterface.sequelize.query('SELECT * FROM playbackSessions;')
      assert.deepStrictEqual(playbackSessionsAfter, playbackSessions)

      const playlistMediaItemsAfter = await queryInterface.sequelize.query('SELECT * FROM playlistMediaItems;')
      assert.deepStrictEqual(playlistMediaItemsAfter, playlistMediaItems)

      const mediaProgressesAfter = await queryInterface.sequelize.query('SELECT * FROM mediaProgresses;')
      assert.deepStrictEqual(mediaProgressesAfter, mediaProgresses)
    })

    it('should keep correct table foreign key constraints', async () => {
      // Create tables with correct foreign key constraints: libraryItems, feeds, mediaItemShares, playbackSessions, playlistMediaItems, mediaProgresses
      await queryInterface.sequelize.query('CREATE TABLE `libraryItems` (`id` UUID PRIMARY KEY, `libraryId` UUID REFERENCES `libraries` (`id`) ON DELETE SET NULL ON UPDATE CASCADE, `libraryFolderId` UUID REFERENCES `libraryFolders` (`id`) ON DELETE SET NULL ON UPDATE CASCADE);')
      await queryInterface.sequelize.query('CREATE TABLE `feeds` (`id` UUID PRIMARY KEY, `userId` UUID REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE);')
      await queryInterface.sequelize.query('CREATE TABLE `mediaItemShares` (`id` UUID PRIMARY KEY, `userId` UUID REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE);')
      await queryInterface.sequelize.query('CREATE TABLE `playbackSessions` (`id` UUID PRIMARY KEY, `userId` UUID REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE, `deviceId` UUID REFERENCES `devices` (`id`) ON DELETE SET NULL ON UPDATE CASCADE, `libraryId` UUID REFERENCES `libraries` (`id`) ON DELETE SET NULL ON UPDATE CASCADE);')
      await queryInterface.sequelize.query('CREATE TABLE `playlistMediaItems` (`id` UUID PRIMARY KEY, `playlistId` UUID REFERENCES `playlists` (`id`) ON DELETE CASCADE ON UPDATE CASCADE);')
      await queryInterface.sequelize.query('CREATE TABLE `mediaProgresses` (`id` UUID PRIMARY KEY, `userId` UUID REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE);')

      //
      // Insert test data into tables
      //
      await queryInterface.bulkInsert('users', [{ id: 'e1a96857-48a8-43b6-8966-abc909c55b0f' }])
      await queryInterface.bulkInsert('libraries', [{ id: 'a41a40e3-f516-40f5-810d-757ab668ebba' }])
      await queryInterface.bulkInsert('libraryFolders', [{ id: 'b41a40e3-f516-40f5-810d-757ab668ebba' }])
      await queryInterface.bulkInsert('playlists', [{ id: 'f41a40e3-f516-40f5-810d-757ab668ebba' }])
      await queryInterface.bulkInsert('devices', [{ id: 'g41a40e3-f516-40f5-810d-757ab668ebba' }])

      await queryInterface.bulkInsert('libraryItems', [{ id: 'c1a96857-48a8-43b6-8966-abc909c55b0f', libraryId: 'a41a40e3-f516-40f5-810d-757ab668ebba', libraryFolderId: 'b41a40e3-f516-40f5-810d-757ab668ebba' }])
      await queryInterface.bulkInsert('feeds', [{ id: 'd1a96857-48a8-43b6-8966-abc909c55b0f', userId: 'e1a96857-48a8-43b6-8966-abc909c55b0f' }])
      await queryInterface.bulkInsert('mediaItemShares', [{ id: 'h1a96857-48a8-43b6-8966-abc909c55b0f', userId: 'e1a96857-48a8-43b6-8966-abc909c55b0f' }])
      await queryInterface.bulkInsert('playbackSessions', [{ id: 'f1a96857-48a8-43b6-8966-abc909c55b0x', userId: 'e1a96857-48a8-43b6-8966-abc909c55b0f', deviceId: 'g41a40e3-f516-40f5-810d-757ab668ebba', libraryId: 'a41a40e3-f516-40f5-810d-757ab668ebba' }])
      await queryInterface.bulkInsert('playlistMediaItems', [{ id: 'i1a96857-48a8-43b6-8966-abc909c55b0f', playlistId: 'f41a40e3-f516-40f5-810d-757ab668ebba' }])
      await queryInterface.bulkInsert('mediaProgresses', [{ id: 'j1a96857-48a8-43b6-8966-abc909c55b0f', userId: 'e1a96857-48a8-43b6-8966-abc909c55b0f' }])

      //
      // Query data before migration
      //
      const libraryItems = await queryInterface.sequelize.query('SELECT * FROM libraryItems;')
      const feeds = await queryInterface.sequelize.query('SELECT * FROM feeds;')
      const mediaItemShares = await queryInterface.sequelize.query('SELECT * FROM mediaItemShares;')
      const playbackSessions = await queryInterface.sequelize.query('SELECT * FROM playbackSessions;')
      const playlistMediaItems = await queryInterface.sequelize.query('SELECT * FROM playlistMediaItems;')
      const mediaProgresses = await queryInterface.sequelize.query('SELECT * FROM mediaProgresses;')

      await up({ context: { queryInterface, logger: Logger } })

      assert.strictEqual(loggerInfoStub.callCount, 14)
      assert.strictEqual(loggerInfoStub.getCall(0).calledWith(sinon.match('[2.17.3 migration] UPGRADE BEGIN: 2.17.3-fk-constraints')), true)
      assert.strictEqual(loggerInfoStub.getCall(1).calledWith(sinon.match('[2.17.3 migration] Updating libraryItems constraints')), true)
      assert.strictEqual(loggerInfoStub.getCall(2).calledWith(sinon.match('[2.17.3 migration] No changes needed for libraryItems constraints')), true)
      assert.strictEqual(loggerInfoStub.getCall(3).calledWith(sinon.match('[2.17.3 migration] Updating feeds constraints')), true)
      assert.strictEqual(loggerInfoStub.getCall(4).calledWith(sinon.match('[2.17.3 migration] No changes needed for feeds constraints')), true)
      assert.strictEqual(loggerInfoStub.getCall(5).calledWith(sinon.match('[2.17.3 migration] Updating mediaItemShares constraints')), true)
      assert.strictEqual(loggerInfoStub.getCall(6).calledWith(sinon.match('[2.17.3 migration] No changes needed for mediaItemShares constraints')), true)
      assert.strictEqual(loggerInfoStub.getCall(7).calledWith(sinon.match('[2.17.3 migration] Updating playbackSessions constraints')), true)
      assert.strictEqual(loggerInfoStub.getCall(8).calledWith(sinon.match('[2.17.3 migration] No changes needed for playbackSessions constraints')), true)
      assert.strictEqual(loggerInfoStub.getCall(9).calledWith(sinon.match('[2.17.3 migration] Updating playlistMediaItems constraints')), true)
      assert.strictEqual(loggerInfoStub.getCall(10).calledWith(sinon.match('[2.17.3 migration] No changes needed for playlistMediaItems constraints')), true)
      assert.strictEqual(loggerInfoStub.getCall(11).calledWith(sinon.match('[2.17.3 migration] Updating mediaProgresses constraints')), true)
      assert.strictEqual(loggerInfoStub.getCall(12).calledWith(sinon.match('[2.17.3 migration] No changes needed for mediaProgresses constraints')), true)
      assert.strictEqual(loggerInfoStub.getCall(13).calledWith(sinon.match('[2.17.3 migration] UPGRADE END: 2.17.3-fk-constraints')), true)

      //
      // Validate that data is not changed
      //
      const libraryItemsAfter = await queryInterface.sequelize.query('SELECT * FROM libraryItems;')
      assert.deepStrictEqual(libraryItemsAfter, libraryItems)

      const feedsAfter = await queryInterface.sequelize.query('SELECT * FROM feeds;')
      assert.deepStrictEqual(feedsAfter, feeds)

      const mediaItemSharesAfter = await queryInterface.sequelize.query('SELECT * FROM mediaItemShares;')
      assert.deepStrictEqual(mediaItemSharesAfter, mediaItemShares)

      const playbackSessionsAfter = await queryInterface.sequelize.query('SELECT * FROM playbackSessions;')
      assert.deepStrictEqual(playbackSessionsAfter, playbackSessions)

      const playlistMediaItemsAfter = await queryInterface.sequelize.query('SELECT * FROM playlistMediaItems;')
      assert.deepStrictEqual(playlistMediaItemsAfter, playlistMediaItems)

      const mediaProgressesAfter = await queryInterface.sequelize.query('SELECT * FROM mediaProgresses;')
      assert.deepStrictEqual(mediaProgressesAfter, mediaProgresses)
    })
  })
})
