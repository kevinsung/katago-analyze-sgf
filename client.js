const net = require('net')

const SERVER_PORT = 6364

function main() {
  const argv = require('yargs').command(
    '$0 COMMAND [PARAMS]',
    'Process SGF files using the KataGo analysis engine - daemon.',
    (yargs) => {
      yargs.positional('COMMAND', {
        describe: 'The command. Options: "submit", "list-jobs"',
        type: 'string',
      })
      yargs.positional('PARAMS', {
        describe: 'Parameters to the command.',
        type: 'string',
      })
    }
  ).argv

  let {COMMAND, PARAMS} = argv
  try {
    PARAMS = JSON.parse(PARAMS)
  } catch {}

  const connection = net.createConnection(SERVER_PORT)

  connection.on('error', (error) => {
    switch (error.code) {
      case 'ECONNREFUSED':
        console.error(
          `Error: Could not connect to server port ${SERVER_PORT}. ` +
            'Make sure the KataGo analysis server is running.'
        )
        break
      default:
        console.error(error)
    }
  })

  connection.on('data', (data) => {
    const response = JSON.parse(data)
    const {result, error} = response
    if (error) {
      console.error('Error:')
      console.error(error)
    } else {
      console.log(result)
    }
    connection.destroy()
  })

  connection.on('ready', () => {
    const request = {method: COMMAND, params: PARAMS, id: 0}
    connection.write(JSON.stringify(request))
  })
}

if (module === require.main) {
  main()
}
