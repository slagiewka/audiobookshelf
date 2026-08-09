const assert = require('node:assert/strict')
const { describe, it, beforeEach, afterEach } = require('node:test')
const sinon = require('sinon')
const Logger = require('../../server/Logger') // Adjust the path as needed
const { LogLevel } = require('../../server/utils/constants')
const date = require('../../server/libs/dateAndTime')
const util = require('util')

describe('Logger', function () {
  let consoleTraceStub
  let consoleDebugStub
  let consoleInfoStub
  let consoleWarnStub
  let consoleErrorStub
  let consoleLogStub

  beforeEach(function () {
    // Stub the date format function to return a consistent timestamp
    sinon.stub(date, 'format').returns('2024-09-10 12:34:56.789')
    // Stub the source getter to return a consistent source
    sinon.stub(Logger, 'source').get(() => 'some/source.js')
    // Stub the console methods used in Logger
    consoleTraceStub = sinon.stub(console, 'trace')
    consoleDebugStub = sinon.stub(console, 'debug')
    consoleInfoStub = sinon.stub(console, 'info')
    consoleWarnStub = sinon.stub(console, 'warn')
    consoleErrorStub = sinon.stub(console, 'error')
    consoleLogStub = sinon.stub(console, 'log')
    // Initialize the Logger's logManager as a mock object
    Logger.logManager = {
      logToFile: sinon.stub().resolves()
    }
  })

  afterEach(function () {
    sinon.restore()
  })

  describe('logging methods', function () {
    it('should have a method for each log level defined in the static block', function () {
      const loggerMethods = Object.keys(LogLevel).map((key) => key.toLowerCase())

      loggerMethods.forEach((method) => {
        assert.strictEqual(typeof Logger[method], 'function')
      })
    })

    it('should call console.trace for trace logging', function () {
      // Arrange
      Logger.logLevel = LogLevel.TRACE

      // Act
      Logger.trace('Test message')

      // Assert
      assert.strictEqual(consoleTraceStub.calledOnce, true)
    })

    it('should call console.debug for debug logging', function () {
      // Arrange
      Logger.logLevel = LogLevel.TRACE

      // Act
      Logger.debug('Test message')

      // Assert
      assert.strictEqual(consoleDebugStub.calledOnce, true)
    })

    it('should call console.info for info logging', function () {
      // Arrange
      Logger.logLevel = LogLevel.TRACE

      // Act
      Logger.info('Test message')

      // Assert
      assert.strictEqual(consoleInfoStub.calledOnce, true)
    })

    it('should call console.warn for warn logging', function () {
      // Arrange
      Logger.logLevel = LogLevel.TRACE

      // Act
      Logger.warn('Test message')

      // Assert
      assert.strictEqual(consoleWarnStub.calledOnce, true)
    })

    it('should call console.error for error logging', function () {
      // Arrange
      Logger.logLevel = LogLevel.TRACE

      // Act
      Logger.error('Test message')

      // Assert
      assert.strictEqual(consoleErrorStub.calledOnce, true)
    })

    it('should call console.error for fatal logging', function () {
      // Arrange
      Logger.logLevel = LogLevel.TRACE

      // Act
      Logger.fatal('Test message')

      // Assert
      assert.strictEqual(consoleErrorStub.calledOnce, true)
    })

    it('should call console.log for note logging', function () {
      // Arrange
      Logger.logLevel = LogLevel.TRACE

      // Act
      Logger.note('Test message')

      // Assert
      assert.strictEqual(consoleLogStub.calledOnce, true)
    })
  })

  describe('#log', function () {
    it('should log to console and file if level is high enough', async function () {
      // Arrange
      const logArgs = ['Test message']
      Logger.logLevel = LogLevel.TRACE

      // Act
      Logger.debug(...logArgs)

      assert.strictEqual(consoleDebugStub.calledOnce, true)
      assert.strictEqual(consoleDebugStub.calledWithExactly('[2024-09-10 12:34:56.789] DEBUG:', ...logArgs), true)
      assert.strictEqual(Logger.logManager.logToFile.calledOnce, true)
      assert.strictEqual(
        Logger.logManager.logToFile.calledWithExactly({
          timestamp: '2024-09-10 12:34:56.789',
          source: 'some/source.js',
          message: 'Test message',
          levelName: 'DEBUG',
          level: LogLevel.DEBUG
        })
      , true)
    })

    it('should not log if log level is too low', function () {
      // Arrange
      const logArgs = ['This log should not appear']
      // Set log level to ERROR, so DEBUG log should be ignored
      Logger.logLevel = LogLevel.ERROR

      // Act
      Logger.debug(...logArgs)

      // Verify console.debug is not called
      assert.strictEqual(consoleDebugStub.called, false)
      assert.strictEqual(Logger.logManager.logToFile.called, false)
    })

    it('should emit log to all connected sockets with appropriate log level', async function () {
      // Arrange
      const socket1 = { id: '1', emit: sinon.spy() }
      const socket2 = { id: '2', emit: sinon.spy() }
      Logger.addSocketListener(socket1, LogLevel.DEBUG)
      Logger.addSocketListener(socket2, LogLevel.ERROR)
      const logArgs = ['Socket test']
      Logger.logLevel = LogLevel.TRACE

      // Act
      await Logger.debug(...logArgs)

      // socket1 should receive the log, but not socket2
      assert.strictEqual(socket1.emit.calledOnce, true)
      assert.strictEqual(
        socket1.emit.calledWithExactly('log', {
          timestamp: '2024-09-10 12:34:56.789',
          source: 'some/source.js',
          message: 'Socket test',
          levelName: 'DEBUG',
          level: LogLevel.DEBUG
        })
      , true)

      assert.strictEqual(socket2.emit.called, false)
    })

    it('should log fatal messages to console and file regardless of log level', async function () {
      // Arrange
      const logArgs = ['Fatal error']
      // Set log level to NOTE + 1, so nothing should be logged
      Logger.logLevel = LogLevel.NOTE + 1

      // Act
      await Logger.fatal(...logArgs)

      // Assert
      assert.strictEqual(consoleErrorStub.calledOnce, true)
      assert.strictEqual(consoleErrorStub.calledWithExactly('[2024-09-10 12:34:56.789] FATAL:', ...logArgs), true)
      assert.strictEqual(Logger.logManager.logToFile.calledOnce, true)
      assert.strictEqual(
        Logger.logManager.logToFile.calledWithExactly({
          timestamp: '2024-09-10 12:34:56.789',
          source: 'some/source.js',
          message: 'Fatal error',
          levelName: 'FATAL',
          level: LogLevel.FATAL
        })
      , true)
    })

    it('should log note messages to console and file regardless of log level', async function () {
      // Arrange
      const logArgs = ['Note message']
      // Set log level to NOTE + 1, so nothing should be logged
      Logger.logLevel = LogLevel.NOTE + 1

      // Act
      await Logger.note(...logArgs)

      // Assert
      assert.strictEqual(consoleLogStub.calledOnce, true)
      assert.strictEqual(consoleLogStub.calledWithExactly('[2024-09-10 12:34:56.789] NOTE:', ...logArgs), true)
      assert.strictEqual(Logger.logManager.logToFile.calledOnce, true)
      assert.strictEqual(
        Logger.logManager.logToFile.calledWithExactly({
          timestamp: '2024-09-10 12:34:56.789',
          source: 'some/source.js',
          message: 'Note message',
          levelName: 'NOTE',
          level: LogLevel.NOTE
        })
      , true)
    })

    it('should log util.inspect(arg) for non-string objects', async function () {
      // Arrange
      const obj = { key: 'value' }
      const logArgs = ['Logging object:', obj]
      Logger.logLevel = LogLevel.TRACE

      // Act
      await Logger.debug(...logArgs)

      // Assert
      assert.strictEqual(consoleDebugStub.calledOnce, true)
      assert.strictEqual(consoleDebugStub.calledWithExactly('[2024-09-10 12:34:56.789] DEBUG:', 'Logging object:', obj), true)
      assert.strictEqual(Logger.logManager.logToFile.calledOnce, true)
      assert.strictEqual(Logger.logManager.logToFile.firstCall.args[0].message, 'Logging object: ' + util.inspect(obj))
    })
  })

  describe('socket listeners', function () {
    it('should add and remove socket listeners', function () {
      // Arrange
      const socket1 = { id: '1', emit: sinon.spy() }
      const socket2 = { id: '2', emit: sinon.spy() }

      // Act
      Logger.addSocketListener(socket1, LogLevel.DEBUG)
      Logger.addSocketListener(socket2, LogLevel.ERROR)
      Logger.removeSocketListener('1')

      // Assert
      assert.strictEqual(Logger.socketListeners.length, 1)
      assert.strictEqual(Logger.socketListeners[0].id, '2')
    })
  })

  describe('setLogLevel', function () {
    it('should change the log level and log the new level', function () {
      // Arrange
      const debugSpy = sinon.spy(Logger, 'debug')

      // Act
      Logger.setLogLevel(LogLevel.WARN)

      // Assert
      assert.strictEqual(Logger.logLevel, LogLevel.WARN)
      assert.strictEqual(debugSpy.calledOnce, true)
      assert.strictEqual(debugSpy.calledWithExactly('Set Log Level to WARN'), true)
    })
  })
})
