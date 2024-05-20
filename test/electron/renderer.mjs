import { Conf } from '../../dist/renderer.mjs'

window.addEventListener('DOMContentLoaded', () => {
  const conf = new Conf()
  conf.set({
    bar: {
      baz: 1
    }
  })
  window.api?.did()
})
