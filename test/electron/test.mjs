export default class TestRPC {
  methonds = {}

  constructor() {
    const onMessage = async ({ invocationId, cmd, args }) => {
      let method = this.methonds[cmd]

      if (!method) {
        if (cmd === 'ready') {
          return
        }
        method = () => new Error('Invalid method: ' + cmd)
      }

      try {
        const resolve = await method(...args)
        process.send({ invocationId, resolve })
      } catch (err) {
        const reject = {
          message: err.message,
          stack: err.stack,
          name: err.name
        }
        process.send({ invocationId, reject })
      }
    }

    if (process.env.APP_TEST) {
      process.on('message', onMessage)
    }
  }

  register(cmd, cb) {
    this.methonds[cmd] = cb
  }

  ready() {
    process.send({ invocationId: 0, resolve: true })
  }
}
