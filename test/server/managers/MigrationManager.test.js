const assert = require('node:assert/strict')
const { describe, it, beforeEach, afterEach } = require('node:test')
const sinon = require('sinon')
const { Sequelize } = require('sequelize')
const fs = require('../../../server/libs/fsExtra')
const Logger = require('../../../server/Logger')
const MigrationManager = require('../../../server/managers/MigrationManager')
const path = require('path')
const { Umzug, memoryStorage } = require('../../../server/libs/umzug')

describe('MigrationManager', () => {
  let sequelizeStub
  let umzugStub
  let migrationManager
  let loggerInfoStub
  let loggerErrorStub
  let fsCopyStub
  let fsMoveStub
  let fsRemoveStub
  let fsEnsureDirStub
  let processExitStub
  let configPath = '/path/to/config'

  const serverVersion = '1.2.0'

  beforeEach(() => {
    sequelizeStub = sinon.createStubInstance(Sequelize)
    umzugStub = {
      migrations: sinon.stub(),
      executed: sinon.stub(),
      up: sinon.stub(),
      down: sinon.stub()
    }
    sequelizeStub.getQueryInterface.returns({})
    migrationManager = new MigrationManager(sequelizeStub, false, configPath)
    migrationManager.fetchVersionsFromDatabase = sinon.stub().resolves()
    migrationManager.copyMigrationsToConfigDir = sinon.stub().resolves()
    migrationManager.updateMaxVersion = sinon.stub().resolves()
    migrationManager.initUmzug = sinon.stub()
    migrationManager.umzug = umzugStub
    loggerInfoStub = sinon.stub(Logger, 'info')
    loggerErrorStub = sinon.stub(Logger, 'error')
    fsCopyStub = sinon.stub(fs, 'copy').resolves()
    fsMoveStub = sinon.stub(fs, 'move').resolves()
    fsRemoveStub = sinon.stub(fs, 'remove').resolves()
    fsEnsureDirStub = sinon.stub(fs, 'ensureDir').resolves()
    fsPathExistsStub = sinon.stub(fs, 'pathExists').resolves(true)
    processExitStub = sinon.stub(process, 'exit')
  })

  afterEach(() => {
    sinon.restore()
  })

  describe('init', () => {
    it('should initialize the MigrationManager', async () => {
      // arrange
      migrationManager.databaseVersion = '1.1.0'
      migrationManager.maxVersion = '1.1.0'
      migrationManager.umzug = null
      migrationManager.configPath = __dirname

      // Act
      await migrationManager.init(serverVersion)

      // Assert
      assert.strictEqual(fsEnsureDirStub.calledOnce, true)
      assert.strictEqual(fsEnsureDirStub.calledWith(migrationManager.migrationsDir), true)
      assert.strictEqual(migrationManager.serverVersion, serverVersion)
      assert.strictEqual(migrationManager.sequelize, sequelizeStub)
      assert.strictEqual(migrationManager.migrationsDir, path.join(__dirname, 'migrations'))
      assert.strictEqual(migrationManager.copyMigrationsToConfigDir.calledOnce, true)
      assert.strictEqual(migrationManager.updateMaxVersion.calledOnce, true)
      assert.strictEqual(migrationManager.initialized, true)
    })

    it('should throw error if serverVersion is not provided', async () => {
      // Act
      try {
        const result = await migrationManager.init()
        expect.fail('Expected init to throw an error, but it did not.')
      } catch (error) {
        assert.strictEqual(error.message, 'Invalid server version: undefined. Expected a version tag like v1.2.3.')
      }
    })
  })

  describe('runMigrations', () => {
    it('should run up migrations successfully', async () => {
      // Arrange
      migrationManager.databaseVersion = '1.1.0'
      migrationManager.maxVersion = '1.1.0'
      migrationManager.serverVersion = '1.2.0'
      migrationManager.initialized = true

      umzugStub.migrations.resolves([{ name: 'v1.1.0-migration.js' }, { name: 'v1.1.1-migration.js' }, { name: 'v1.2.0-migration.js' }])
      umzugStub.executed.resolves([{ name: 'v1.1.0-migration.js' }])

      // Act
      await migrationManager.runMigrations()

      // Assert
      assert.strictEqual(migrationManager.initUmzug.calledOnce, true)
      assert.strictEqual(umzugStub.up.calledOnce, true)
      assert.strictEqual(umzugStub.up.calledWith({ migrations: ['v1.1.1-migration.js', 'v1.2.0-migration.js'], rerun: 'ALLOW' }), true)
      assert.strictEqual(fsCopyStub.calledOnce, true)
      assert.strictEqual(fsCopyStub.calledWith(path.join(configPath, 'absdatabase.sqlite'), path.join(configPath, 'absdatabase.backup.sqlite')), true)
      assert.strictEqual(fsRemoveStub.calledOnce, true)
      assert.strictEqual(fsRemoveStub.calledWith(path.join(configPath, 'absdatabase.backup.sqlite')), true)
      assert.strictEqual(loggerInfoStub.calledWith(sinon.match('Migrations successfully applied')), true)
    })

    it('should run down migrations successfully', async () => {
      // Arrange
      migrationManager.databaseVersion = '1.2.0'
      migrationManager.maxVersion = '1.2.0'
      migrationManager.serverVersion = '1.1.0'
      migrationManager.initialized = true

      umzugStub.migrations.resolves([{ name: 'v1.1.0-migration.js' }, { name: 'v1.1.1-migration.js' }, { name: 'v1.2.0-migration.js' }])
      umzugStub.executed.resolves([{ name: 'v1.1.0-migration.js' }, { name: 'v1.1.1-migration.js' }, { name: 'v1.2.0-migration.js' }])

      // Act
      await migrationManager.runMigrations()

      // Assert
      assert.strictEqual(migrationManager.initUmzug.calledOnce, true)
      assert.strictEqual(umzugStub.down.calledOnce, true)
      assert.strictEqual(umzugStub.down.calledWith({ migrations: ['v1.2.0-migration.js', 'v1.1.1-migration.js'], rerun: 'ALLOW' }), true)
      assert.strictEqual(fsCopyStub.calledOnce, true)
      assert.strictEqual(fsCopyStub.calledWith(path.join(configPath, 'absdatabase.sqlite'), path.join(configPath, 'absdatabase.backup.sqlite')), true)
      assert.strictEqual(fsRemoveStub.calledOnce, true)
      assert.strictEqual(fsRemoveStub.calledWith(path.join(configPath, 'absdatabase.backup.sqlite')), true)
      assert.strictEqual(loggerInfoStub.calledWith(sinon.match('Migrations successfully applied')), true)
    })

    it('should log that migrations will be skipped if database is new', async () => {
      // Arrange
      migrationManager.isDatabaseNew = true
      migrationManager.initialized = true

      // Act
      await migrationManager.runMigrations()

      // Assert
      assert.strictEqual(loggerInfoStub.calledWith(sinon.match('Database is new. Skipping migrations.')), true)
      assert.strictEqual(migrationManager.initUmzug.called, false)
      assert.strictEqual(umzugStub.up.called, false)
      assert.strictEqual(umzugStub.down.called, false)
    })

    it('should log that no migrations are needed if serverVersion equals databaseVersion', async () => {
      // Arrange
      migrationManager.serverVersion = '1.2.0'
      migrationManager.databaseVersion = '1.2.0'
      migrationManager.maxVersion = '1.2.0'
      migrationManager.initialized = true

      // Act
      await migrationManager.runMigrations()

      // Assert
      assert.strictEqual(umzugStub.up.called, false)
      assert.strictEqual(loggerInfoStub.calledWith(sinon.match('Database is already up to date.')), true)
    })

    it('should handle migration failure and restore the original database', async () => {
      // Arrange
      migrationManager.serverVersion = '1.2.0'
      migrationManager.databaseVersion = '1.1.0'
      migrationManager.maxVersion = '1.1.0'
      migrationManager.initialized = true

      umzugStub.migrations.resolves([{ name: 'v1.2.0-migration.js' }])
      umzugStub.executed.resolves([{ name: 'v1.1.0-migration.js' }])
      umzugStub.up.rejects(new Error('Migration failed'))

      const originalDbPath = path.join(configPath, 'absdatabase.sqlite')
      const backupDbPath = path.join(configPath, 'absdatabase.backup.sqlite')

      // Act
      await migrationManager.runMigrations()

      // Assert
      assert.strictEqual(migrationManager.initUmzug.calledOnce, true)
      assert.strictEqual(umzugStub.up.calledOnce, true)
      assert.strictEqual(loggerErrorStub.calledWith(sinon.match('Migration failed')), true)
      assert.strictEqual(fsMoveStub.calledWith(originalDbPath, sinon.match('absdatabase.failed.sqlite'), { overwrite: true }), true)
      assert.strictEqual(fsMoveStub.calledWith(backupDbPath, originalDbPath, { overwrite: true }), true)
      assert.strictEqual(loggerInfoStub.calledWith(sinon.match('Restored the original database')), true)
      assert.strictEqual(processExitStub.calledOnce, true)
    })
  })

  describe('fetchVersionsFromDatabase', () => {
    it('should fetch versions from the migrationsMeta table', async () => {
      // Arrange
      const sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
      // Create a migrationsMeta table and populate it with version and maxVersion
      await sequelize.query('CREATE TABLE migrationsMeta (key VARCHAR(255), value VARCHAR(255))')
      await sequelize.query("INSERT INTO migrationsMeta (key, value) VALUES ('version', '1.1.0'), ('maxVersion', '1.1.0')")
      const migrationManager = new MigrationManager(sequelize, false, configPath)
      migrationManager.checkOrCreateMigrationsMetaTable = sinon.stub().resolves()

      // Act
      await migrationManager.fetchVersionsFromDatabase()

      // Assert
      assert.strictEqual(migrationManager.maxVersion, '1.1.0')
      assert.strictEqual(migrationManager.databaseVersion, '1.1.0')
    })

    it('should create the migrationsMeta table if it does not exist and fetch versions from it', async () => {
      // Arrange
      const sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
      const migrationManager = new MigrationManager(sequelize, false, configPath)
      migrationManager.serverVersion = serverVersion

      // Act
      await migrationManager.fetchVersionsFromDatabase()

      // Assert
      const tableDescription = await sequelize.getQueryInterface().describeTable('migrationsMeta')
      assert.deepStrictEqual(tableDescription, {
        key: { type: 'VARCHAR(255)', allowNull: false, defaultValue: undefined, primaryKey: false, unique: false },
        value: { type: 'VARCHAR(255)', allowNull: false, defaultValue: undefined, primaryKey: false, unique: false }
      })
      assert.strictEqual(migrationManager.maxVersion, '0.0.0')
      assert.strictEqual(migrationManager.databaseVersion, '0.0.0')
    })

    it('should create the migrationsMeta with databaseVersion=serverVersion if database is new', async () => {
      // Arrange
      const sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
      const migrationManager = new MigrationManager(sequelize, true, configPath)
      migrationManager.serverVersion = serverVersion

      // Act
      await migrationManager.fetchVersionsFromDatabase()

      // Assert
      const tableDescription = await sequelize.getQueryInterface().describeTable('migrationsMeta')
      assert.deepStrictEqual(tableDescription, {
        key: { type: 'VARCHAR(255)', allowNull: false, defaultValue: undefined, primaryKey: false, unique: false },
        value: { type: 'VARCHAR(255)', allowNull: false, defaultValue: undefined, primaryKey: false, unique: false }
      })
      assert.strictEqual(migrationManager.maxVersion, '0.0.0')
      assert.strictEqual(migrationManager.databaseVersion, serverVersion)
    })

    it('should re-create the migrationsMeta table if it existed and database is new (Database force=true)', async () => {
      // Arrange
      const sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
      // Create a migrationsMeta table and populate it with version and maxVersion
      await sequelize.query('CREATE TABLE migrationsMeta (key VARCHAR(255), value VARCHAR(255))')
      await sequelize.query("INSERT INTO migrationsMeta (key, value) VALUES ('version', '1.1.0'), ('maxVersion', '1.1.0')")
      const migrationManager = new MigrationManager(sequelize, true, configPath)
      migrationManager.serverVersion = serverVersion

      // Act
      await migrationManager.fetchVersionsFromDatabase()

      // Assert
      assert.strictEqual(migrationManager.maxVersion, '0.0.0')
      assert.strictEqual(migrationManager.databaseVersion, serverVersion)
    })

    it('should throw an error if the database query fails', async () => {
      // Arrange
      const sequelizeStub = sinon.createStubInstance(Sequelize)
      sequelizeStub.query.rejects(new Error('Database query failed'))
      const migrationManager = new MigrationManager(sequelizeStub, false, configPath)
      migrationManager.checkOrCreateMigrationsMetaTable = sinon.stub().resolves()

      // Act
      try {
        await migrationManager.fetchVersionsFromDatabase()
        expect.fail('Expected fetchVersionsFromDatabase to throw an error, but it did not.')
      } catch (error) {
        // Assert
        assert.strictEqual(error.message, 'Database query failed')
      }
    })
  })

  describe('updateMaxVersion', () => {
    it('should update the maxVersion in the database', async () => {
      // Arrange
      const sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
      // Create a migrationsMeta table and populate it with version and maxVersion
      await sequelize.query('CREATE TABLE migrationsMeta (key VARCHAR(255), value VARCHAR(255))')
      await sequelize.query("INSERT INTO migrationsMeta (key, value) VALUES ('version', '1.1.0'), ('maxVersion', '1.1.0')")
      const migrationManager = new MigrationManager(sequelize, false, configPath)
      migrationManager.serverVersion = '1.2.0'

      // Act
      await migrationManager.updateMaxVersion()

      // Assert
      const [{ maxVersion }] = await sequelize.query("SELECT value AS maxVersion FROM migrationsMeta WHERE key = 'maxVersion'", {
        type: Sequelize.QueryTypes.SELECT
      })
      assert.strictEqual(maxVersion, '1.2.0')
    })
  })

  describe('extractVersionFromTag', () => {
    it('should return null if tag is not provided', () => {
      // Arrange
      const migrationManager = new MigrationManager(sequelizeStub, false, configPath)

      // Act
      const result = migrationManager.extractVersionFromTag()

      // Assert
      assert.strictEqual(result, null)
    })

    it('should return null if tag does not match the version format', () => {
      // Arrange
      const migrationManager = new MigrationManager(sequelizeStub, false, configPath)
      const tag = 'invalid-tag'

      // Act
      const result = migrationManager.extractVersionFromTag(tag)

      // Assert
      assert.strictEqual(result, null)
    })

    it('should extract the version from the tag', () => {
      // Arrange
      const migrationManager = new MigrationManager(sequelizeStub, false, configPath)
      const tag = 'v1.2.3'

      // Act
      const result = migrationManager.extractVersionFromTag(tag)

      // Assert
      assert.strictEqual(result, '1.2.3')
    })
  })

  describe('copyMigrationsToConfigDir', () => {
    it('should copy migrations to the config directory', async () => {
      // Arrange
      const migrationManager = new MigrationManager(sequelizeStub, false, configPath)
      migrationManager.migrationsDir = path.join(configPath, 'migrations')
      const migrationsSourceDir = path.join(__dirname, '..', '..', '..', 'server', 'migrations')
      const targetDir = migrationManager.migrationsDir
      const files = ['migration1.js', 'migration2.js', 'readme.md']

      const readdirStub = sinon.stub(fs, 'readdir').resolves(files)

      // Act
      await migrationManager.copyMigrationsToConfigDir()

      // Assert
      assert.strictEqual(readdirStub.calledOnce, true)
      assert.strictEqual(readdirStub.calledWith(migrationsSourceDir), true)
      assert.strictEqual(fsCopyStub.calledTwice, true)
      assert.strictEqual(fsCopyStub.calledWith(path.join(migrationsSourceDir, 'migration1.js'), path.join(targetDir, 'migration1.js')), true)
      assert.strictEqual(fsCopyStub.calledWith(path.join(migrationsSourceDir, 'migration2.js'), path.join(targetDir, 'migration2.js')), true)
    })

    it('should throw an error if copying the migrations fails', async () => {
      // Arrange
      const migrationManager = new MigrationManager(sequelizeStub, false, configPath)
      migrationManager.migrationsDir = path.join(configPath, 'migrations')
      const migrationsSourceDir = path.join(__dirname, '..', '..', '..', 'server', 'migrations')
      const targetDir = migrationManager.migrationsDir
      const files = ['migration1.js', 'migration2.js', 'readme.md']

      const readdirStub = sinon.stub(fs, 'readdir').resolves(files)
      fsCopyStub.restore()
      fsCopyStub = sinon.stub(fs, 'copy').rejects()

      // Act
      try {
        // Act
        await migrationManager.copyMigrationsToConfigDir()
        expect.fail('Expected copyMigrationsToConfigDir to throw an error, but it did not.')
      } catch (error) {}

      // Assert
      assert.strictEqual(readdirStub.calledOnce, true)
      assert.strictEqual(readdirStub.calledWith(migrationsSourceDir), true)
      assert.strictEqual(fsCopyStub.calledTwice, true)
      assert.strictEqual(fsCopyStub.calledWith(path.join(migrationsSourceDir, 'migration1.js'), path.join(targetDir, 'migration1.js')), true)
      assert.strictEqual(fsCopyStub.calledWith(path.join(migrationsSourceDir, 'migration2.js'), path.join(targetDir, 'migration2.js')), true)
    })
  })

  describe('findMigrationsToRun', () => {
    it('should return migrations to run when direction is "up"', () => {
      // Arrange
      const migrations = [{ name: 'v1.0.0-migration.js' }, { name: 'v1.1.0-migration.js' }, { name: 'v1.2.0-migration.js' }, { name: 'v1.3.0-migration.js' }]
      const executedMigrations = ['v1.0.0-migration.js']
      migrationManager.databaseVersion = '1.0.0'
      migrationManager.serverVersion = '1.2.0'
      const direction = 'up'

      // Act
      const result = migrationManager.findMigrationsToRun(migrations, executedMigrations, direction)

      // Assert
      assert.deepStrictEqual(result, ['v1.1.0-migration.js', 'v1.2.0-migration.js'])
    })

    it('should return migrations to run when direction is "down"', () => {
      // Arrange
      const migrations = [{ name: 'v1.0.0-migration.js' }, { name: 'v1.1.0-migration.js' }, { name: 'v1.2.0-migration.js' }, { name: 'v1.3.0-migration.js' }]
      const executedMigrations = ['v1.2.0-migration.js', 'v1.3.0-migration.js']
      migrationManager.databaseVersion = '1.3.0'
      migrationManager.serverVersion = '1.2.0'
      const direction = 'down'

      // Act
      const result = migrationManager.findMigrationsToRun(migrations, executedMigrations, direction)

      // Assert
      assert.deepStrictEqual(result, ['v1.3.0-migration.js'])
    })

    it('should return empty array when no migrations to run up', () => {
      // Arrange
      const migrations = [{ name: 'v1.0.0-migration.js' }, { name: 'v1.1.0-migration.js' }, { name: 'v1.2.0-migration.js' }, { name: 'v1.3.0-migration.js' }]
      const executedMigrations = ['v1.0.0-migration.js', 'v1.1.0-migration.js', 'v1.2.0-migration.js', 'v1.3.0-migration.js']
      migrationManager.databaseVersion = '1.3.0'
      migrationManager.serverVersion = '1.4.0'
      const direction = 'up'

      // Act
      const result = migrationManager.findMigrationsToRun(migrations, executedMigrations, direction)

      // Assert
      assert.deepStrictEqual(result, [])
    })

    it('should return empty array when no migrations to run down', () => {
      // Arrange
      const migrations = [{ name: 'v1.0.0-migration.js' }, { name: 'v1.1.0-migration.js' }, { name: 'v1.2.0-migration.js' }, { name: 'v1.3.0-migration.js' }]
      const executedMigrations = []
      migrationManager.databaseVersion = '1.4.0'
      migrationManager.serverVersion = '1.3.0'
      const direction = 'down'

      // Act
      const result = migrationManager.findMigrationsToRun(migrations, executedMigrations, direction)

      // Assert
      assert.deepStrictEqual(result, [])
    })

    it('should return down migrations to run when direction is "down" and up migration was not executed', () => {
      // Arrange
      const migrations = [{ name: 'v1.0.0-migration.js' }, { name: 'v1.1.0-migration.js' }, { name: 'v1.2.0-migration.js' }, { name: 'v1.3.0-migration.js' }]
      const executedMigrations = []
      migrationManager.databaseVersion = '1.3.0'
      migrationManager.serverVersion = '1.0.0'
      const direction = 'down'

      // Act
      const result = migrationManager.findMigrationsToRun(migrations, executedMigrations, direction)

      // Assert
      assert.deepStrictEqual(result, ['v1.3.0-migration.js', 'v1.2.0-migration.js', 'v1.1.0-migration.js'])
    })

    it('should return empty array when direction is "down" and server version is higher than database version', () => {
      // Arrange
      const migrations = [{ name: 'v1.0.0-migration.js' }, { name: 'v1.1.0-migration.js' }, { name: 'v1.2.0-migration.js' }, { name: 'v1.3.0-migration.js' }]
      const executedMigrations = ['v1.0.0-migration.js', 'v1.1.0-migration.js', 'v1.2.0-migration.js', 'v1.3.0-migration.js']
      migrationManager.databaseVersion = '1.0.0'
      migrationManager.serverVersion = '1.3.0'
      const direction = 'down'

      // Act
      const result = migrationManager.findMigrationsToRun(migrations, executedMigrations, direction)

      // Assert
      assert.deepStrictEqual(result, [])
    })

    it('should return empty array when direction is "up" and server version is lower than database version', () => {
      // Arrange
      const migrations = [{ name: 'v1.0.0-migration.js' }, { name: 'v1.1.0-migration.js' }, { name: 'v1.2.0-migration.js' }, { name: 'v1.3.0-migration.js' }]
      const executedMigrations = ['v1.0.0-migration.js', 'v1.1.0-migration.js', 'v1.2.0-migration.js', 'v1.3.0-migration.js']
      migrationManager.databaseVersion = '1.3.0'
      migrationManager.serverVersion = '1.0.0'
      const direction = 'up'

      // Act
      const result = migrationManager.findMigrationsToRun(migrations, executedMigrations, direction)

      // Assert
      assert.deepStrictEqual(result, [])
    })

    it('should return up migrations to run when server version is between migrations', () => {
      // Arrange
      const migrations = [{ name: 'v1.0.0-migration.js' }, { name: 'v1.1.0-migration.js' }, { name: 'v1.2.0-migration.js' }, { name: 'v1.3.0-migration.js' }]
      const executedMigrations = ['v1.0.0-migration.js', 'v1.1.0-migration.js']
      migrationManager.databaseVersion = '1.1.0'
      migrationManager.serverVersion = '1.2.3'
      const direction = 'up'

      // Act
      const result = migrationManager.findMigrationsToRun(migrations, executedMigrations, direction)

      // Assert
      assert.deepStrictEqual(result, ['v1.2.0-migration.js'])
    })

    it('should return down migrations to run when server version is between migrations', () => {
      // Arrange
      const migrations = [{ name: 'v1.0.0-migration.js' }, { name: 'v1.1.0-migration.js' }, { name: 'v1.2.0-migration.js' }, { name: 'v1.3.0-migration.js' }]
      const executedMigrations = ['v1.0.0-migration.js', 'v1.1.0-migration.js', 'v1.2.0-migration.js']
      migrationManager.databaseVersion = '1.2.0'
      migrationManager.serverVersion = '1.1.3'
      const direction = 'down'

      // Act
      const result = migrationManager.findMigrationsToRun(migrations, executedMigrations, direction)

      // Assert
      assert.deepStrictEqual(result, ['v1.2.0-migration.js'])
    })
  })

  describe('initUmzug', () => {
    it('should initialize the umzug instance with migrations in the proper order', async () => {
      // Arrange
      const readdirStub = sinon.stub(fs, 'readdir').resolves(['v1.0.0-migration.js', 'v1.10.0-migration.js', 'v1.2.0-migration.js', 'v1.1.0-migration.js'])
      const readFileSyncStub = sinon.stub(fs, 'readFileSync').returns('module.exports = { up: () => {}, down: () => {} }')
      const umzugStorage = memoryStorage()
      migrationManager = new MigrationManager(sequelizeStub, false, configPath)
      migrationManager.migrationsDir = path.join(configPath, 'migrations')
      const resolvedMigrationNames = ['v1.0.0-migration.js', 'v1.1.0-migration.js', 'v1.2.0-migration.js', 'v1.10.0-migration.js']
      const resolvedMigrationPaths = resolvedMigrationNames.map((name) => path.resolve(path.join(migrationManager.migrationsDir, name)))

      // Act
      await migrationManager.initUmzug(umzugStorage)

      // Assert
      assert.strictEqual(readdirStub.calledOnce, true)
      assert.ok(migrationManager.umzug instanceof Umzug)
      const migrations = await migrationManager.umzug.migrations()
      assert.deepStrictEqual(migrations.map((m) => m.name), resolvedMigrationNames)
      assert.deepStrictEqual(migrations.map((m) => m.path), resolvedMigrationPaths)
    })
  })
})
