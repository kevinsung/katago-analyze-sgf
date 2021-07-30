const {spawn} = require('child_process')
const EventEmitter = require('events')

class Engine extends EventEmitter {
  constructor(katagoPath, analysisConfig) {
    super()
    this.setMaxListeners(Infinity)
    this.katago = spawn(katagoPath, ['analysis', '-config', analysisConfig])
    this.katago.stdout.setEncoding('utf8')
    this.katago.stdout.on('data', (data) => {
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
