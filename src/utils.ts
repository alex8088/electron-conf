import util from 'node:util'

export function deepEqual(val1: unknown, val2: unknown): boolean {
  return util.isDeepStrictEqual(val1, val2)
}

export function createPlainObject<T = Record<string, unknown>>(): T {
  return Object.create(null)
}

export function cloneObject<T = Record<string, unknown>>(source: T): T {
  return Object.assign(createPlainObject(), source)
}

export function mergeObject<T = Record<string, unknown>>(
  ...sources: unknown[]
): T {
  return Object.assign(createPlainObject(), ...sources)
}

export function deepCloneObject<T = Record<string, unknown>>(source: T): T {
  if (source === null || typeof source !== 'object') {
    return source
  }

  const cloned = Array.isArray(source) ? ([] as T) : ({} as T)

  for (const key in source) {
    cloned[key] = deepCloneObject(source[key])
  }

  return cloned
}
