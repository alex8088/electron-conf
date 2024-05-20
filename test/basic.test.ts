import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { it, expect, describe, afterAll } from 'vitest'

import { BaseConf } from '../src/conf'
import { JSONSchema, Migration } from '../src/types'

const dir = path.join(process.cwd(), 'tmp')

const expected = 'foo'
const unexpected = 'bar'

type TestObj = { foo?: string }
type NestedTestObj = TestObj & {
  bar?: {
    baz?: number
  }
}

const genTmpName = (): string => {
  const randomBytes = crypto.randomBytes(4)
  return randomBytes.toString('hex')
}

describe('constructor options', () => {
  it('name', () => {
    const name = genTmpName()
    const conf = new BaseConf<TestObj>({ dir, name })
    expect(conf.get('foo')).toBeUndefined()
    conf.set('foo', expected)
    expect(conf.get('foo')).toBe(expected)
    expect(fs.existsSync(conf.fileName)).to.be.true
  })

  describe.sequential('defaults', () => {
    const name = genTmpName()
    it('no value', () => {
      const defaults = {
        foo: expected
      }
      const conf = new BaseConf<TestObj>({ dir, name, defaults })
      expect(conf.get('foo')).toBe(expected)
    })
    it('already has a value', () => {
      const defaults = {
        foo: unexpected
      }
      const conf = new BaseConf<{ foo?: string }>({ dir, name, defaults })
      expect(conf.get('foo')).not.toBe(unexpected)
    })
  })

  describe.sequential('schema', () => {
    const schema: JSONSchema<NestedTestObj> = {
      type: 'object',
      properties: {
        foo: {
          type: 'string',
          maxLength: 10,
          nullable: true
        },
        bar: {
          type: 'object',
          properties: {
            baz: {
              type: 'number',
              maximum: 99,
              nullable: true
            }
          },
          nullable: true
        }
      }
    }
    const defaults = {
      bar: { baz: 100 }
    }
    const errExpected = /^Config schema violation/

    it('validate defaults', () => {
      const name = genTmpName()
      expect(
        () => new BaseConf<NestedTestObj>({ dir, name, defaults, schema })
      ).toThrowError(errExpected)
    })
    it('valid set', () => {
      const name = genTmpName()
      const conf = new BaseConf<NestedTestObj>({ dir, name, schema })
      conf.set('foo', expected.repeat(3))
      expect(conf.get('foo')).toBe(expected.repeat(3))
      expect(() => conf.set('foo', expected.repeat(4))).toThrowError(
        errExpected
      )
    })
  })

  describe.sequential('migrations', () => {
    const name = genTmpName()
    const migrations: Migration<NestedTestObj>[] = [
      {
        version: 1,
        hook: (conf): void => conf.set('foo', expected)
      }
    ]
    const secondMigrations: Migration<NestedTestObj>[] = [
      ...migrations,
      {
        version: 2,
        hook: (conf): void => conf.set('bar.baz', 0)
      }
    ]

    const defaults = {
      foo: unexpected
    }

    it('do migrate and update migration version', () => {
      const conf = new BaseConf<NestedTestObj>({
        dir,
        name,
        defaults,
        migrations
      })
      expect(conf.get('__internal__.migrationVersion')).toBe(1)
      expect(conf.get('foo')).toBe(expected)
      conf.set('foo', unexpected)
    })

    it('only higher version migration operation will be performed', () => {
      const conf = new BaseConf<NestedTestObj>({
        dir,
        name,
        defaults,
        migrations: secondMigrations
      })
      expect(conf.get('__internal__.migrationVersion')).toBe(2)
      expect(conf.get('foo')).toBe(unexpected)
      expect(conf.get('bar.baz')).toBe(0)
    })
  })
})

describe.sequential('instance methods', () => {
  const name = genTmpName()
  const defaults = {
    bar: { baz: 100 }
  }

  const conf = new BaseConf<NestedTestObj>({ dir, name, defaults })

  it('.get()', () => {
    expect(conf.get('foo')).toBeUndefined()
    expect(conf.get('foo', expected)).toBe(expected)
    conf.set('foo', expected)
    expect(conf.get('foo')).toBe(expected)
    expect(conf.get('bar.baz')).toBe(100)
    expect(conf.get('bar')).toEqual({ baz: 100 })
  })

  it('.set()', () => {
    conf.set('foo', 'hello')
    conf.set('bar.baz', 0)
    expect(conf.get('foo')).toBe('hello')
    expect(conf.get('bar.baz')).toBe(0)
    conf.set({
      foo: 'world',
      bar: {
        baz: 1
      }
    })
    expect(conf.get('foo')).toBe('world')
    expect(conf.get('bar.baz')).toBe(1)
    expect(conf.get('bar')).toEqual({ baz: 1 })
    expect(() => conf.set('foo', () => {})).toThrowError(
      /^Setting a value of type/
    )
  })

  it('.has()', () => {
    expect(conf.has('foo')).to.be.true
    expect(conf.has('boo')).to.be.false
  })

  it('.reset()', () => {
    expect(conf.get('bar')).not.toEqual({ baz: 100 })
    conf.reset('bar')
    expect(conf.get('bar')).toEqual({ baz: 100 })
  })

  it('.delete()', () => {
    conf.delete('foo')
    expect(conf.get('foo')).toBeUndefined()
    conf.delete('bar.baz')
    expect(conf.get('bar.baz')).toBeUndefined()
  })

  it('.clear()', () => {
    conf.set('foo', 'bar')
    conf.clear()
    expect(conf.get('foo')).toBeUndefined()
    expect(conf.get('bar.baz')).toBe(100)
  })

  it('.onDidChange()', () => {
    const fooCb = (newValue, oldValue): void => {
      expect(oldValue).toBeUndefined()
      expect(newValue).toBe(expected)
    }

    const bazCb = (newValue, oldValue): void => {
      expect(oldValue).toBe(100)
      expect(newValue).toBeUndefined()
    }

    const unsubscribe1 = conf.onDidChange('foo', fooCb)
    const unsubscribe2 = conf.onDidChange('bar.baz', bazCb)

    conf.set('foo', expected)
    unsubscribe1()

    conf.delete('bar.baz')
    unsubscribe2()
  })

  it('.onDidAnyChange()', () => {
    const cb = (newValue, oldValue): void => {
      expect(oldValue).not.toStrictEqual(newValue)
    }

    const unsubscribe = conf.onDidAnyChange(cb)

    conf.set('foo', unexpected)
    unsubscribe()
  })
})

afterAll(() => {
  const files = fs.readdirSync(dir)
  for (let i = 0; i < files.length; i++) {
    fs.unlinkSync(path.join(dir, files[i]))
  }
  fs.rmdirSync(dir)
})
