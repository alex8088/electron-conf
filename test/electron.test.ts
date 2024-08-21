import { ChildProcess, spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import electronPath from 'electron/index'
import { it, expect, beforeAll, afterAll } from 'vitest'

type ElectronTestOptions = {
  path: string
  args: string[]
  env?: Record<string, string>
}

type ElectronTestMessage = {
  invocationId: number
  resolve: any
  reject: any
}

interface ElectronTestRPCMap {
  [key: number]: {
    resolve: (value: any | PromiseLike<any>) => void
    reject: (reason: any) => void
  }
}

class ElectronTest {
  private ps?: ChildProcess
  private rpcMap: ElectronTestRPCMap = {}
  private invocationId = 0

  constructor(readonly options: ElectronTestOptions) {}

  async launch(): Promise<void> {
    this.ps = spawn(this.options.path, this.options.args, {
      stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
      env: { APP_TEST: 'true', ...this.options.env }
    })

    // listen for RPC messages from the app
    this.ps.on('message', (msg: ElectronTestMessage) => {
      const res = this.rpcMap[msg.invocationId]
      if (!res) return
      delete this.rpcMap[msg.invocationId]
      if (msg.reject) res.reject(msg.reject)
      else res.resolve(msg.resolve)
    })

    return this.rpc('ready')
  }

  async rpc<T>(cmd: string, ...args): Promise<T> {
    if (!this.ps) {
      throw Error(
        'The test instance is not initialized, please call the `.launch()` method first'
      )
    }
    const invocationId = this.invocationId++
    this.ps.send({ invocationId, cmd, args })
    return new Promise<T>(
      (resolve, reject) => (this.rpcMap[invocationId] = { resolve, reject })
    )
  }

  stop(): void {
    this.ps?.kill()
  }
}

const context = new ElectronTest({
  path: electronPath,
  args: ['./test/electron/main.mjs']
})

beforeAll(async () => {
  await context.launch().catch(() => {
    context.stop()
    process.exit(1)
  })
}, 3000)

it('default path', async () => {
  const electronUserDataDir = await context.rpc<string>(
    'electron_user_data_dir'
  )
  const configFilePath = await context.rpc<string>('config_file_path')
  expect(fs.existsSync(configFilePath)).to.be.true
  expect(path.dirname(configFilePath)).toBe(electronUserDataDir)
})

it('supports renderer', async () => {
  const result = await context.rpc<{ baz: number; zoo: string }>('renderer')
  expect(result.baz).toBe(1)
  expect(result.zoo).toBe('zoo')
})

afterAll(async () => {
  const configPath = await context.rpc<string>('config_file_path')
  fs.unlinkSync(configPath)
  context.stop()
})
