const isServiceName = (name) => /^[a-z][A-Za-z0-9]*Service$/.test(name)
const isServiceClassName = (name) => /^[A-Z][A-Za-z0-9]*Service$/.test(name)

const unwrapTypeExpression = (expression) => {
  while (
    expression &&
    ['TSAsExpression', 'TSNonNullExpression', 'TSSatisfiesExpression', 'TSTypeAssertion'].includes(
      expression.type,
    )
  ) {
    expression = expression.expression
  }
  return expression
}

const isServiceValue = (name, expression) => {
  const value = unwrapTypeExpression(expression)
  if (value?.type === 'ObjectExpression') return true
  if (value?.type !== 'CallExpression') return false

  const callee = value.callee
  return (
    callee.type === 'MemberExpression' &&
    !callee.computed &&
    callee.property.type === 'Identifier' &&
    callee.property.name === 'getInstance' &&
    callee.object.type === 'Identifier' &&
    callee.object.name === name[0].toUpperCase() + name.slice(1) &&
    value.arguments.length === 0
  )
}

export default {
  meta: {
    type: 'problem',
    messages: {
      invalidExport: 'Service modules may export only one service and types.',
      duplicateService: 'Service modules may export only one runtime service.',
    },
  },
  create(context) {
    let hasServiceExport = false

    const markServiceExport = (node) => {
      if (hasServiceExport) {
        context.report({ node, messageId: 'duplicateService' })
      } else {
        hasServiceExport = true
      }
    }

    return {
      ExportNamedDeclaration(node) {
        const declaration = node.declaration
        if (
          node.exportKind === 'type' ||
          declaration?.type === 'TSInterfaceDeclaration' ||
          declaration?.type === 'TSTypeAliasDeclaration'
        ) {
          return
        }

        if (!declaration) {
          if (
            node.specifiers.length > 0 &&
            node.specifiers.every((item) => item.exportKind === 'type')
          ) {
            return
          }
          context.report({ node, messageId: 'invalidExport' })
          return
        }

        if (declaration.type === 'ClassDeclaration') {
          if (isServiceClassName(declaration.id?.name ?? '')) {
            markServiceExport(declaration)
          } else {
            context.report({ node: declaration, messageId: 'invalidExport' })
          }
          return
        }

        if (declaration.type !== 'VariableDeclaration' || declaration.kind !== 'const') {
          context.report({ node, messageId: 'invalidExport' })
          return
        }

        for (const item of declaration.declarations) {
          const name = item.id.type === 'Identifier' ? item.id.name : ''
          if (isServiceName(name) && isServiceValue(name, item.init)) {
            markServiceExport(item)
          } else {
            context.report({ node: item, messageId: 'invalidExport' })
          }
        }
      },
      ExportDefaultDeclaration(node) {
        context.report({ node, messageId: 'invalidExport' })
      },
      ExportAllDeclaration(node) {
        if (node.exportKind !== 'type') {
          context.report({ node, messageId: 'invalidExport' })
        }
      },
    }
  },
}
