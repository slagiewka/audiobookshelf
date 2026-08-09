const assert = require('node:assert/strict')
const { describe, it, beforeEach } = require('node:test')
const sinon = require('sinon')
const fileUtils = require('../../../server/utils/fileUtils')
const fs = require('../../../server/libs/fsExtra')
const EventEmitter = require('events')

const { generateFFMetadata, addCoverAndMetadataToFile } = require('../../../server/utils/ffmpegHelpers')

global.isWin = process.platform === 'win32'

describe('generateFFMetadata', () => {
  function createTestSetup() {
    const metadata = {
      title: 'My Audiobook',
      artist: 'John Doe',
      album: 'Best Audiobooks'
    }

    const chapters = [
      { start: 0, end: 1000, title: 'Chapter 1' },
      { start: 1000, end: 2000, title: 'Chapter 2' }
    ]

    return { metadata, chapters }
  }

  let metadata = null
  let chapters = null
  beforeEach(() => {
    const input = createTestSetup()
    metadata = input.metadata
    chapters = input.chapters
  })

  it('should generate ffmetadata content with chapters', () => {
    const result = generateFFMetadata(metadata, chapters)

    assert.strictEqual(result, ';FFMETADATA1\ntitle=My Audiobook\nartist=John Doe\nalbum=Best Audiobooks\n\n[CHAPTER]\nTIMEBASE=1/1000\nSTART=0\nEND=1000000\ntitle=Chapter 1\n\n[CHAPTER]\nTIMEBASE=1/1000\nSTART=1000000\nEND=2000000\ntitle=Chapter 2\n')
  })

  it('should generate ffmetadata content without chapters', () => {
    chapters = null

    const result = generateFFMetadata(metadata, chapters)

    assert.strictEqual(result, ';FFMETADATA1\ntitle=My Audiobook\nartist=John Doe\nalbum=Best Audiobooks\n')
  })

  it('should handle chapters with no title', () => {
    chapters = [
      { start: 0, end: 1000 },
      { start: 1000, end: 2000 }
    ]

    const result = generateFFMetadata(metadata, chapters)

    assert.strictEqual(result, ';FFMETADATA1\ntitle=My Audiobook\nartist=John Doe\nalbum=Best Audiobooks\n\n[CHAPTER]\nTIMEBASE=1/1000\nSTART=0\nEND=1000000\n\n[CHAPTER]\nTIMEBASE=1/1000\nSTART=1000000\nEND=2000000\n')
  })

  it('should handle metadata escaping special characters (=, ;, #,  and a newline)', () => {
    metadata.title = 'My Audiobook; with = special # characters\n'
    chapters[0].title = 'Chapter #1'

    const result = generateFFMetadata(metadata, chapters)

    assert.strictEqual(result, ';FFMETADATA1\ntitle=My Audiobook\\; with \\= special \\# characters\\\n\nartist=John Doe\nalbum=Best Audiobooks\n\n[CHAPTER]\nTIMEBASE=1/1000\nSTART=0\nEND=1000000\ntitle=Chapter \\#1\n\n[CHAPTER]\nTIMEBASE=1/1000\nSTART=1000000\nEND=2000000\ntitle=Chapter 2\n')
  })
})

describe('addCoverAndMetadataToFile', () => {
  function createTestSetup() {
    const audioFilePath = '/path/to/audio/file.mp3'
    const coverFilePath = '/path/to/cover/image.jpg'
    const metadataFilePath = '/path/to/metadata/file.txt'
    const track = 1
    const mimeType = 'audio/mpeg'

    const ffmpegStub = new EventEmitter()
    ffmpegStub.input = sinon.stub().returnsThis()
    ffmpegStub.outputOptions = sinon.stub().returnsThis()
    ffmpegStub.output = sinon.stub().returnsThis()
    ffmpegStub.input = sinon.stub().returnsThis()
    ffmpegStub.run = sinon.stub().callsFake(() => {
      ffmpegStub.emit('end')
    })
    const copyStub = sinon.stub().resolves()
    const fsRemoveStub = sinon.stub(fs, 'remove').resolves()

    return { audioFilePath, coverFilePath, metadataFilePath, track, mimeType, ffmpegStub, copyStub, fsRemoveStub }
  }

  let audioFilePath = null
  let coverFilePath = null
  let metadataFilePath = null
  let track = null
  let mimeType = null
  let ffmpegStub = null
  let copyStub = null
  let fsRemoveStub = null
  beforeEach(() => {
    const input = createTestSetup()
    audioFilePath = input.audioFilePath
    coverFilePath = input.coverFilePath
    metadataFilePath = input.metadataFilePath
    track = input.track
    mimeType = input.mimeType
    ffmpegStub = input.ffmpegStub
    copyStub = input.copyStub
    fsRemoveStub = input.fsRemoveStub
  })

  it('should add cover image and metadata to audio file', async () => {
    // Act
    await addCoverAndMetadataToFile(audioFilePath, coverFilePath, metadataFilePath, track, mimeType, null, ffmpegStub, copyStub)

    // Assert
    assert.strictEqual(ffmpegStub.input.calledThrice, true)
    assert.strictEqual(ffmpegStub.input.getCall(0).args[0], audioFilePath)
    assert.strictEqual(ffmpegStub.input.getCall(1).args[0], metadataFilePath)
    assert.strictEqual(ffmpegStub.input.getCall(2).args[0], coverFilePath)

    assert.strictEqual(ffmpegStub.outputOptions.callCount, 4)
    assert.deepStrictEqual(ffmpegStub.outputOptions.getCall(0).args[0], ['-map 0:a', '-map_metadata 1', '-map_metadata 0', '-map_chapters 1', '-c copy'])
    assert.deepStrictEqual(ffmpegStub.outputOptions.getCall(1).args[0], ['-metadata track=1'])
    assert.deepStrictEqual(ffmpegStub.outputOptions.getCall(2).args[0], ['-id3v2_version 3'])
    assert.deepStrictEqual(ffmpegStub.outputOptions.getCall(3).args[0], ['-map 2:v', '-disposition:v:0 attached_pic', '-metadata:s:v', 'title=Cover', '-metadata:s:v', 'comment=Cover'])

    assert.strictEqual(ffmpegStub.output.calledOnce, true)
    assert.strictEqual(ffmpegStub.output.firstCall.args[0], '/path/to/audio/file.tmp.mp3')

    assert.strictEqual(ffmpegStub.run.calledOnce, true)

    assert.strictEqual(copyStub.calledOnce, true)
    assert.strictEqual(copyStub.firstCall.args[0], '/path/to/audio/file.tmp.mp3')
    assert.strictEqual(copyStub.firstCall.args[1], '/path/to/audio/file.mp3')
    assert.strictEqual(fsRemoveStub.calledOnce, true)
    assert.strictEqual(fsRemoveStub.firstCall.args[0], '/path/to/audio/file.tmp.mp3')

    // Restore the stub
    sinon.restore()
  })

  it('should handle missing cover image', async () => {
    // Arrange
    coverFilePath = null

    // Act
    await addCoverAndMetadataToFile(audioFilePath, coverFilePath, metadataFilePath, track, mimeType, null, ffmpegStub, copyStub)

    // Assert
    assert.strictEqual(ffmpegStub.input.calledTwice, true)
    assert.strictEqual(ffmpegStub.input.getCall(0).args[0], audioFilePath)
    assert.strictEqual(ffmpegStub.input.getCall(1).args[0], metadataFilePath)

    assert.strictEqual(ffmpegStub.outputOptions.callCount, 4)
    assert.deepStrictEqual(ffmpegStub.outputOptions.getCall(0).args[0], ['-map 0:a', '-map_metadata 1', '-map_metadata 0', '-map_chapters 1', '-c copy'])
    assert.deepStrictEqual(ffmpegStub.outputOptions.getCall(1).args[0], ['-metadata track=1'])
    assert.deepStrictEqual(ffmpegStub.outputOptions.getCall(2).args[0], ['-id3v2_version 3'])
    assert.deepStrictEqual(ffmpegStub.outputOptions.getCall(3).args[0], ['-map 0:v?'])

    assert.strictEqual(ffmpegStub.output.calledOnce, true)
    assert.strictEqual(ffmpegStub.output.firstCall.args[0], '/path/to/audio/file.tmp.mp3')

    assert.strictEqual(ffmpegStub.run.calledOnce, true)

    assert.strictEqual(copyStub.callCount, 1)
    assert.strictEqual(copyStub.firstCall.args[0], '/path/to/audio/file.tmp.mp3')
    assert.strictEqual(copyStub.firstCall.args[1], '/path/to/audio/file.mp3')
    assert.strictEqual(fsRemoveStub.calledOnce, true)
    assert.strictEqual(fsRemoveStub.firstCall.args[0], '/path/to/audio/file.tmp.mp3')

    // Restore the stub
    sinon.restore()
  })

  it('should handle error during ffmpeg execution', async () => {
    // Arrange
    ffmpegStub.run = sinon.stub().callsFake(() => {
      ffmpegStub.emit('error', new Error('FFmpeg error'))
    })

    // Act
    try {
      await addCoverAndMetadataToFile(audioFilePath, coverFilePath, metadataFilePath, track, mimeType, null, ffmpegStub, copyStub)
      expect.fail('Expected an error to be thrown')
    } catch (error) {
      // Assert
      assert.strictEqual(error.message, 'FFmpeg error')
    }

    // Assert
    assert.strictEqual(ffmpegStub.input.calledThrice, true)
    assert.strictEqual(ffmpegStub.input.getCall(0).args[0], audioFilePath)
    assert.strictEqual(ffmpegStub.input.getCall(1).args[0], metadataFilePath)
    assert.strictEqual(ffmpegStub.input.getCall(2).args[0], coverFilePath)

    assert.strictEqual(ffmpegStub.outputOptions.callCount, 4)
    assert.deepStrictEqual(ffmpegStub.outputOptions.getCall(0).args[0], ['-map 0:a', '-map_metadata 1', '-map_metadata 0', '-map_chapters 1', '-c copy'])
    assert.deepStrictEqual(ffmpegStub.outputOptions.getCall(1).args[0], ['-metadata track=1'])
    assert.deepStrictEqual(ffmpegStub.outputOptions.getCall(2).args[0], ['-id3v2_version 3'])
    assert.deepStrictEqual(ffmpegStub.outputOptions.getCall(3).args[0], ['-map 2:v', '-disposition:v:0 attached_pic', '-metadata:s:v', 'title=Cover', '-metadata:s:v', 'comment=Cover'])

    assert.strictEqual(ffmpegStub.output.calledOnce, true)
    assert.strictEqual(ffmpegStub.output.firstCall.args[0], '/path/to/audio/file.tmp.mp3')

    assert.strictEqual(ffmpegStub.run.calledOnce, true)

    assert.strictEqual(copyStub.called, false)
    assert.strictEqual(fsRemoveStub.called, false)

    // Restore the stub
    sinon.restore()
  })

  it('should handle m4b embedding', async () => {
    // Arrange
    mimeType = 'audio/mp4'
    audioFilePath = '/path/to/audio/file.m4b'

    // Act
    await addCoverAndMetadataToFile(audioFilePath, coverFilePath, metadataFilePath, track, mimeType, null, ffmpegStub, copyStub)

    // Assert
    assert.strictEqual(ffmpegStub.input.calledThrice, true)
    assert.strictEqual(ffmpegStub.input.getCall(0).args[0], audioFilePath)
    assert.strictEqual(ffmpegStub.input.getCall(1).args[0], metadataFilePath)
    assert.strictEqual(ffmpegStub.input.getCall(2).args[0], coverFilePath)

    assert.strictEqual(ffmpegStub.outputOptions.callCount, 4)
    assert.deepStrictEqual(ffmpegStub.outputOptions.getCall(0).args[0], ['-map 0:a', '-map_metadata 1', '-map_metadata 0', '-map_chapters 1', '-c copy'])
    assert.deepStrictEqual(ffmpegStub.outputOptions.getCall(1).args[0], ['-metadata track=1'])
    assert.deepStrictEqual(ffmpegStub.outputOptions.getCall(2).args[0], ['-f mp4'])
    assert.deepStrictEqual(ffmpegStub.outputOptions.getCall(3).args[0], ['-map 2:v', '-disposition:v:0 attached_pic', '-metadata:s:v', 'title=Cover', '-metadata:s:v', 'comment=Cover'])

    assert.strictEqual(ffmpegStub.output.calledOnce, true)
    assert.strictEqual(ffmpegStub.output.firstCall.args[0], '/path/to/audio/file.tmp.m4b')

    assert.strictEqual(ffmpegStub.run.calledOnce, true)

    assert.strictEqual(copyStub.calledOnce, true)
    assert.strictEqual(copyStub.firstCall.args[0], '/path/to/audio/file.tmp.m4b')
    assert.strictEqual(copyStub.firstCall.args[1], '/path/to/audio/file.m4b')
    assert.strictEqual(fsRemoveStub.calledOnce, true)
    assert.strictEqual(fsRemoveStub.firstCall.args[0], '/path/to/audio/file.tmp.m4b')

    // Restore the stub
    sinon.restore()
  })
})
