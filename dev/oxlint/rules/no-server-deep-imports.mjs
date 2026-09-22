import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('../../../', import.meta.url))

const isWithin = (directory, file) => {
  const relative = path.relative(directory, file)
  return (
    relative === '' ||
    (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
  )
}

export default {
  meta: {
    type: 'problem',
    schema: [
      {
        type: 'object',
        properties: {
          serverDirectory: { type: 'string' },
        },
        required: ['serverDirectory'],
        additionalProperties: false,
      },
    ],
    messages: {
      deepImport: 'Import through a public service entry point instead of a private module file.',
    },
  },
  create(context) {
    const { serverDirectory } = context.options[0]
    const serviceRoot = path.resolve(projectRoot, serverDirectory)
    const filename = path.resolve(context.filename)
    const moduleDirectories = readdirSync(serviceRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => {
        const directory = path.resolve(serviceRoot, entry.name)
        const candidates = [entry.name]
        if (entry.name.endsWith('s')) candidates.push(entry.name.slice(0, -1))
        const publicName = candidates.find((name) => existsSync(path.join(directory, `${name}.ts`)))
        return { directory, publicPath: publicName ? path.join(directory, publicName) : null }
      })

    const checkSource = (node, sourceNode) => {
      const source = sourceNode?.value
      if (typeof source !== 'string' || !source.startsWith('.')) return

      const target = path.resolve(path.dirname(filename), source)
      for (const { directory, publicPath } of moduleDirectories) {
        if (!isWithin(directory, target)) continue
        if (
          isWithin(directory, filename) ||
          (publicPath !== null && publicPath === target.replace(/\.(?:[cm]?[jt]sx?)$/, ''))
        )
          return
        context.report({ node, messageId: 'deepImport' })
        return
      }
    }

    return {
      ImportDeclaration(node) {
        checkSource(node, node.source)
      },
      ExportNamedDeclaration(node) {
        if (node.source) checkSource(node, node.source)
      },
      ExportAllDeclaration(node) {
        checkSource(node, node.source)
      },
      ImportExpression(node) {
        checkSource(node, node.source)
      },
      TSImportType(node) {
        checkSource(node, node.source)
      },
      CallExpression(node) {
        const callee = node.callee
        const isMock =
          callee.type === 'MemberExpression' &&
          !callee.computed &&
          callee.object.type === 'Identifier' &&
          ['vi', 'jest'].includes(callee.object.name) &&
          callee.property.type === 'Identifier' &&
          ['mock', 'doMock'].includes(callee.property.name)
        const isRequire = callee.type === 'Identifier' && callee.name === 'require'
        if (isMock || isRequire) checkSource(node, node.arguments[0])
      },
    }
  },
}
