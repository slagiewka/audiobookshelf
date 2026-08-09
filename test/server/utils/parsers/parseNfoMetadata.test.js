const assert = require('node:assert/strict')
const { describe, it } = require('node:test')
const { parseNfoMetadata } = require('../../../../server/utils/parsers/parseNfoMetadata')

describe('parseNfoMetadata', () => {
  it('returns null if nfoText is empty', () => {
    const result = parseNfoMetadata('')
    assert.strictEqual(result, null)
  })

  it('parses title', () => {
    const nfoText = 'Title: The Great Gatsby'
    const result = parseNfoMetadata(nfoText)
    assert.strictEqual(result.title, 'The Great Gatsby')
  })

  it('parses title with subtitle', () => {
    const nfoText = 'Title: The Great Gatsby: A Novel'
    const result = parseNfoMetadata(nfoText)
    assert.strictEqual(result.title, 'The Great Gatsby')
    assert.strictEqual(result.subtitle, 'A Novel')
  })

  it('does not split title on bare colon without space', () => {
    const nfoText = 'Title: 10:04'
    const result = parseNfoMetadata(nfoText)
    assert.strictEqual(result.title, '10:04')
    assert.strictEqual(result.subtitle, undefined)
  })

  it('does not split title on colon between words without space', () => {
    const nfoText = 'Title: Making the Mission:Impossible Movies'
    const result = parseNfoMetadata(nfoText)
    assert.strictEqual(result.title, 'Making the Mission:Impossible Movies')
    assert.strictEqual(result.subtitle, undefined)
  })

  it('parses authors', () => {
    const nfoText = 'Author: F. Scott Fitzgerald'
    const result = parseNfoMetadata(nfoText)
    assert.deepStrictEqual(result.authors, ['F. Scott Fitzgerald'])
  })

  it('parses multiple authors', () => {
    const nfoText = 'Author: John Steinbeck, Ernest Hemingway'
    const result = parseNfoMetadata(nfoText)
    assert.deepStrictEqual(result.authors, ['John Steinbeck', 'Ernest Hemingway'])
  })

  it('parses narrators', () => {
    const nfoText = 'Read by: Jake Gyllenhaal'
    const result = parseNfoMetadata(nfoText)
    assert.deepStrictEqual(result.narrators, ['Jake Gyllenhaal'])
  })

  it('parses multiple narrators', () => {
    const nfoText = 'Read by: Jake Gyllenhaal, Kate Winslet'
    const result = parseNfoMetadata(nfoText)
    assert.deepStrictEqual(result.narrators, ['Jake Gyllenhaal', 'Kate Winslet'])
  })

  it('parses series name', () => {
    const nfoText = 'Series Name: Harry Potter'
    const result = parseNfoMetadata(nfoText)
    assert.strictEqual(result.series, 'Harry Potter')
  })

  it('parses genre', () => {
    const nfoText = 'Genre: Fiction'
    const result = parseNfoMetadata(nfoText)
    assert.deepStrictEqual(result.genres, ['Fiction'])
  })

  it('parses multiple genres', () => {
    const nfoText = 'Genre: Fiction, Historical'
    const result = parseNfoMetadata(nfoText)
    assert.deepStrictEqual(result.genres, ['Fiction', 'Historical'])
  })

  it('parses tags', () => {
    const nfoText = 'Tags: mystery, thriller'
    const result = parseNfoMetadata(nfoText)
    assert.deepStrictEqual(result.tags, ['mystery', 'thriller'])
  })

  it('parses year from various date fields', () => {
    const nfoText = 'Release Date: 2021-05-01\nBook Copyright: 2021\nRecording Copyright: 2021'
    const result = parseNfoMetadata(nfoText)
    assert.strictEqual(result.publishedYear, '2021')
  })

  it('parses position in series', () => {
    const nfoText = 'Position in Series: 2'
    const result = parseNfoMetadata(nfoText)
    assert.strictEqual(result.sequence, '2')
  })

  it('parses abridged flag', () => {
    const nfoText = 'Abridged: No'
    const result = parseNfoMetadata(nfoText)
    assert.strictEqual(result.abridged, false)

    const nfoText2 = 'Unabridged: Yes'
    const result2 = parseNfoMetadata(nfoText2)
    assert.strictEqual(result2.abridged, false)
  })

  it('parses publisher', () => {
    const nfoText = 'Publisher: Penguin Random House'
    const result = parseNfoMetadata(nfoText)
    assert.strictEqual(result.publisher, 'Penguin Random House')
  })

  it('parses ASIN', () => {
    const nfoText = 'ASIN: B08X5JZJLH'
    const result = parseNfoMetadata(nfoText)
    assert.strictEqual(result.asin, 'B08X5JZJLH')
  })

  it('parses language', () => {
    const nfoText = 'Language: eng'
    const result = parseNfoMetadata(nfoText)
    assert.strictEqual(result.language, 'eng')

    const nfoText2 = 'lang: deu'
    const result2 = parseNfoMetadata(nfoText2)
    assert.strictEqual(result2.language, 'deu')
  })

  it('parses description', () => {
    const nfoText = 'Book Description\n=========\nThis is a book.\n It\'s good'
    const result = parseNfoMetadata(nfoText)
    assert.strictEqual(result.description, 'This is a book.\n It\'s good')
  })

  it('no value', () => {
    const nfoText = 'Title:'
    const result = parseNfoMetadata(nfoText)
    assert.strictEqual(result.title, undefined)
  })

  it('no year value', () => {
    const nfoText = "Date:0"
    const result = parseNfoMetadata(nfoText)
    assert.strictEqual(result.publishedYear, undefined)
  })
})
