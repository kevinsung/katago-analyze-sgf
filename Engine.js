const {spawn} = require('child_process')
const EventEmitter = require('events')

// TODO maybe make this bigger
const BUFFER_SIZE = 1000000

class Engine extends EventEmitter {
  constructor(katagoPath, analysisConfig) {
    super()
    this.setMaxListeners(Infinity)
    this.katagoPath = katagoPath
    this.analysisConfig = analysisConfig
    this.katago = null
    this.buffer = Buffer.alloc(BUFFER_SIZE)
    this.buffer.write('[')
    this.bufferEnd = 1
  }

  start() {
    if (this.katago && !this.katago.killed) {
      return
    }
    this.katago = spawn(this.katagoPath, [
      'analysis',
      '-config',
      this.analysisConfig,
    ])
    this.katago.stdout.on('readable', () => {
      // copy data into buffer
      let data
      while ((data = this.katago.stdout.read())) {
        data.copy(this.buffer, this.bufferEnd)
        this.bufferEnd += data.length
        // TODO check if need to remove line feeds (10)
      }
      this.buffer.write(']', this.bufferEnd)
      // replace newlines between responses with commas
      const str = this.buffer
        .toString('utf8', 0, this.bufferEnd + 1)
        .replaceAll('}\n{', '},{')
      // parse JSON
      try {
        const responses = JSON.parse(str)
        this.bufferEnd = 1
        responses.forEach((response) => {
          this.emit('responseReceived', response)
        })
      } catch (error) {
        // JSON couldn't be parsed yet, need to read more data
      }
    })
    this.katago.stderr.on('data', (data) => {
      const message = String(data)
      console.log(message)
      if (message.includes('Started, ready to begin handling requests')) {
        this.emit('ready')
      }
    })
  }

  stop() {
    if (!this.katago) {
      return
    }
    this.katago.kill()
  }

  sendQuery(query) {
    const {id, analyzeTurns} = query
    const promises = []
    analyzeTurns.forEach((turnNumber) => {
      const promise = new Promise((resolve) => {
        this.on('responseReceived', (response) => {
          const {id: responseId, turnNumber: responseTurnNumber} = response
          if (responseId === id && responseTurnNumber === turnNumber) {
            resolve(response)
          }
        })
      })
      promises.push(promise)
    })
    this.katago.stdin.write(JSON.stringify(query) + '\n')
    return promises
  }
}

module.exports = Engine
