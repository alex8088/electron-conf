import { Conf } from '../../dist/renderer.mjs'

window.addEventListener('DOMContentLoaded', async () => {
  const conf = new Conf()
  conf.set({
    bar: {
      baz: 1
    }
  })
  window.api?.did(await conf.get('zoo', 'zoo'))
})
