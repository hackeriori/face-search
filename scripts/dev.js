const { spawn } = require('child_process')
const { createServer } = require('vite')

async function main() {
  const server = await createServer({
    configFile: './vite.config.ts'
  })
  await server.listen()
  server.printUrls()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
