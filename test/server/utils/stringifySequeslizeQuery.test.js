const assert = require('node:assert/strict')
const { describe, it } = require('node:test')
const stringifySequelizeQuery = require('../../../server/utils/stringifySequelizeQuery')
const Sequelize = require('sequelize')

class DummyClass {}

describe('stringifySequelizeQuery', () => {
  it('should stringify a sequelize query containing an op', () => {
    const query = {
      where: {
        name: 'John',
        age: {
          [Sequelize.Op.gt]: 20
        }
      }
    }

    const result = stringifySequelizeQuery(query)
    assert.strictEqual(result, '{"where":{"name":"John","age":{"Symbol(gt)":20}}}')
  })

  it('should stringify a sequelize query containing a literal', () => {
    const query = {
      order: [[Sequelize.literal('libraryItem.title'), 'ASC']]
    }

    const result = stringifySequelizeQuery(query)
    assert.strictEqual(result, '{"order":{"0":{"0":{"val":"libraryItem.title"},"1":"ASC"}}}')
  })

  it('should stringify a sequelize query containing a class', () => {
    const query = {
      include: [
        {
          model: DummyClass
        }
      ]
    }

    const result = stringifySequelizeQuery(query)
    assert.strictEqual(result, '{"include":{"0":{"model":"DummyClass"}}}')
  })

  it('should ignore non-class functions', () => {
    const query = {
      logging: (query) => console.log(query)
    }

    const result = stringifySequelizeQuery(query)
    assert.strictEqual(result, '{}')
  })
})
