const assert = require('node:assert/strict')
const { describe, it } = require('node:test')
const { parse, nameToLastFirst } = require('../../../../server/utils/parsers/parseNameString')

describe('parseNameString', () => {
  describe('parse', () => {
    it('returns null if nameString is empty', () => {
      const result = parse('')
      assert.strictEqual(result, null)
    })

    it('parses single name in First Last format', () => {
      const result = parse('John Smith')
      assert.deepStrictEqual(result.names, ['John Smith'])
    })

    it('parses single name in Last, First format', () => {
      const result = parse('Smith, John')
      assert.deepStrictEqual(result.names, ['John Smith'])
    })

    it('parses multiple names separated by &', () => {
      const result = parse('John Smith & Jane Doe')
      assert.deepStrictEqual(result.names, ['John Smith', 'Jane Doe'])
    })

    it('parses multiple names separated by "and"', () => {
      const result = parse('John Smith and Jane Doe')
      assert.deepStrictEqual(result.names, ['John Smith', 'Jane Doe'])
    })

    it('parses multiple names separated by comma and "and"', () => {
      const result = parse('John Smith, Jane Doe and John Doe')
      assert.deepStrictEqual(result.names, ['John Smith', 'Jane Doe', 'John Doe'])
    })

    it('parses multiple names separated by semicolon', () => {
      const result = parse('John Smith; Jane Doe')
      assert.deepStrictEqual(result.names, ['John Smith', 'Jane Doe'])
    })

    it('parses multiple names in Last, First format', () => {
      const result = parse('Smith, John, Doe, Jane')
      assert.deepStrictEqual(result.names, ['John Smith', 'Jane Doe'])
    })

    it('parses multiple names with single word name', () => {
      const result = parse('John Smith, Jones, James Doe, Ludwig von Mises')
      assert.deepStrictEqual(result.names, ['John Smith', 'Jones', 'James Doe', 'Ludwig von Mises'])
    })

    it('parses multiple names with single word name listed first (semicolon separator)', () => {
      const result = parse('Jones; John Smith; James Doe; Ludwig von Mises')
      assert.deepStrictEqual(result.names, ['Jones', 'John Smith', 'James Doe', 'Ludwig von Mises'])
    })

    it('handles names with suffixes', () => {
      const result = parse('Smith, John Jr.')
      assert.deepStrictEqual(result.names, ['John Jr. Smith'])
    })

    it('handles compound last names', () => {
      const result = parse('von Mises, Ludwig')
      assert.deepStrictEqual(result.names, ['Ludwig von Mises'])
    })

    it('handles Chinese/Japanese/Korean names', () => {
      const result = parse('张三, 李四')
      assert.deepStrictEqual(result.names, ['张三', '李四'])
    })

    it('removes duplicate names', () => {
      const result = parse('John Smith & John Smith')
      assert.deepStrictEqual(result.names, ['John Smith'])
    })

    it('filters out empty names', () => {
      const result = parse('John Smith,')
      assert.deepStrictEqual(result.names, ['John Smith'])
    })
  })

  describe('nameToLastFirst', () => {
    it('converts First Last to Last, First format', () => {
      const result = nameToLastFirst('John Smith')
      assert.strictEqual(result, 'Smith, John')
    })

    it('returns last name only when no first name', () => {
      const result = nameToLastFirst('Smith')
      assert.strictEqual(result, 'Smith')
    })

    it('handles names with middle names', () => {
      const result = nameToLastFirst('John Middle Smith')
      assert.strictEqual(result, 'Smith, John Middle')
    })
  })
})
