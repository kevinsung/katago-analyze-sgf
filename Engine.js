const {spawn} = require('child_process')
const EventEmitter = require('events')

class Engine extends EventEmitter {
  constructor(katagoPath, analysisConfig) {
    super()
    this.setMaxListeners(Infinity)
    this.katagoPath = katagoPath
    this.analysisConfig = analysisConfig
    this.katago = null
  }

  start() {
    if (this.katago) {
      return
    }
    this.katago = spawn(this.katagoPath, [
      'analysis',
      '-config',
      this.analysisConfig,
    ])
    this.katago.stdout.setEncoding('utf8')
    this.katago.stdout.on('data', (data) => {
      // TODO debug "unexpected end of JSON"
      // TODO (continued) by continually reading until JSON is valid
      // TODO (continued) use 'readable' event instead of 'data' event
      const formatted = '[' + data.replaceAll('}\n{', '},{') + ']'
      const responses = JSON.parse(formatted)
      responses.forEach((response) => {
        this.emit('responseReceived', response)
      })
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
    this.katago = null
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
