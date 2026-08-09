const assert = require('node:assert/strict')
const { describe, it, beforeEach, afterEach } = require('node:test')
const { Sequelize } = require('sequelize')

const Database = require('../../../server/Database')

/**
 * Assert that `expanded` contains every key from `minified` with matching values.
 * Used to enforce the contract: toOldJSONExpanded() is a strict superset of toOldJSONMinified().
 *
 * @param {object} minified
 * @param {object} expanded
 * @param {string} [path]
 */
function assertExpandedSuperset(minified, expanded, path = '') {
  for (const key of Object.keys(minified)) {
    const keyPath = path ? `${path}.${key}` : key
    assert.ok(Object.hasOwn(expanded, key), `missing key ${keyPath}`)

    const minifiedValue = minified[key]
    const expandedValue = expanded[key]

    if (minifiedValue !== null && typeof minifiedValue === 'object' && !Array.isArray(minifiedValue)) {
      assertExpandedSuperset(minifiedValue, expandedValue, keyPath)
    } else if (Array.isArray(minifiedValue)) {
      assert.ok(Array.isArray(expandedValue), `expected array at ${keyPath}`)
      assert.deepStrictEqual(expandedValue, minifiedValue)
    } else {
      assert.strictEqual(expandedValue, minifiedValue, `value mismatch at ${keyPath}`)
    }
  }
}

describe('old JSON serialization', () => {
  let bookLibraryItemId
  let podcastLibraryItemId

  beforeEach(async () => {
    global.ServerSettings = {}
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()

    const bookLibrary = await Database.libraryModel.create({ name: 'Book Library', mediaType: 'book' })
    const bookLibraryFolder = await Database.libraryFolderModel.create({ path: '/books', libraryId: bookLibrary.id })

    const book = await Database.bookModel.create({
      title: 'Test Book',
      audioFiles: [{ index: 1, ino: '1', metadata: { filename: 'track.mp3', ext: '.mp3', path: '/track.mp3', relPath: 'track.mp3', size: 1000 } }],
      tags: ['fiction'],
      narrators: ['Narrator One'],
      genres: ['Fantasy'],
      chapters: [{ id: 0, start: 0, end: 100, title: 'Chapter 1' }],
      ebookFile: { ino: '2', metadata: { filename: 'book.epub', ext: '.epub', path: '/book.epub', relPath: 'book.epub', size: 500 }, ebookFormat: 'epub' }
    })
    const bookLibraryItem = await Database.libraryItemModel.create({
      libraryFiles: [{ ino: '1', metadata: { filename: 'track.mp3', ext: '.mp3', path: '/track.mp3', relPath: 'track.mp3' } }],
      mediaId: book.id,
      mediaType: 'book',
      libraryId: bookLibrary.id,
      libraryFolderId: bookLibraryFolder.id
    })
    bookLibraryItemId = bookLibraryItem.id

    const author = await Database.authorModel.create({ name: 'Test Author', libraryId: bookLibrary.id })
    await Database.bookAuthorModel.create({ bookId: book.id, authorId: author.id })

    const series = await Database.seriesModel.create({ name: 'Test Series', libraryId: bookLibrary.id })
    await Database.bookSeriesModel.create({ bookId: book.id, seriesId: series.id, sequence: '2' })

    const podcastLibrary = await Database.libraryModel.create({ name: 'Podcast Library', mediaType: 'podcast' })
    const podcastLibraryFolder = await Database.libraryFolderModel.create({ path: '/podcasts', libraryId: podcastLibrary.id })

    const podcast = await Database.podcastModel.create({
      title: 'Test Podcast',
      tags: ['news'],
      genres: ['Technology'],
      autoDownloadEpisodes: false
    })
    const podcastLibraryItem = await Database.libraryItemModel.create({
      libraryFiles: [],
      mediaId: podcast.id,
      mediaType: 'podcast',
      libraryId: podcastLibrary.id,
      libraryFolderId: podcastLibraryFolder.id
    })
    podcastLibraryItemId = podcastLibraryItem.id

    await Database.podcastEpisodeModel.create({
      podcastId: podcast.id,
      title: 'Episode 1',
      index: 1,
      audioFile: { ino: '3', metadata: { filename: 'ep1.mp3', ext: '.mp3', path: '/ep1.mp3', relPath: 'ep1.mp3' } }
    })
  })

  afterEach(async () => {
    await Database.sequelize.sync({ force: true })
  })

  describe('Book', () => {
    it('toOldJSONExpanded is a strict superset of toOldJSONMinified', async () => {
      const libraryItem = await Database.libraryItemModel.getExpandedById(bookLibraryItemId)
      const minified = libraryItem.media.toOldJSONMinified()
      const expanded = libraryItem.media.toOldJSONExpanded(libraryItem.id)

      assertExpandedSuperset(minified, expanded)

      assert.strictEqual(expanded['libraryItemId'], libraryItem.id)
      assert.ok(Object.hasOwn(expanded, 'audioFiles'))
      assert.ok(Object.hasOwn(expanded, 'chapters'))
      assert.ok(Object.hasOwn(expanded, 'tracks'))
      assert.strictEqual(expanded.numTracks, expanded.tracks.length)
      assert.strictEqual(expanded.numAudioFiles, expanded.audioFiles.length)
      assert.strictEqual(expanded.numChapters, expanded.chapters.length)
      assert.strictEqual(expanded.ebookFormat, 'epub')
    })
  })

  describe('Podcast', () => {
    it('toOldJSONExpanded is a strict superset of toOldJSONMinified', async () => {
      const libraryItem = await Database.libraryItemModel.getExpandedById(podcastLibraryItemId)
      const minified = libraryItem.media.toOldJSONMinified()
      const expanded = libraryItem.media.toOldJSONExpanded(libraryItem.id)

      assertExpandedSuperset(minified, expanded)

      assert.strictEqual(expanded['libraryItemId'], libraryItem.id)
      assert.ok(Object.hasOwn(expanded, 'episodes'))
      assert.strictEqual(expanded.numEpisodes, expanded.episodes.length)
    })
  })

  describe('LibraryItem', () => {
    it('book library item expanded is a strict superset of minified', async () => {
      const libraryItem = await Database.libraryItemModel.getExpandedById(bookLibraryItemId)
      const minified = libraryItem.toOldJSONMinified()
      const expanded = libraryItem.toOldJSONExpanded()

      assertExpandedSuperset(minified, expanded)

      assert.ok(Object.hasOwn(expanded, 'libraryFiles'))
      assert.ok(Object.hasOwn(expanded, 'lastScan'))
      assert.strictEqual(expanded.numFiles, expanded.libraryFiles.length)
      assert.strictEqual(expanded.media.numTracks, expanded.media.tracks.length)
    })

    it('podcast library item expanded is a strict superset of minified', async () => {
      const libraryItem = await Database.libraryItemModel.getExpandedById(podcastLibraryItemId)
      const minified = libraryItem.toOldJSONMinified()
      const expanded = libraryItem.toOldJSONExpanded()

      assertExpandedSuperset(minified, expanded)

      assert.ok(Object.hasOwn(expanded, 'libraryFiles'))
      assert.strictEqual(expanded.media.numEpisodes, expanded.media.episodes.length)
    })
  })
})
