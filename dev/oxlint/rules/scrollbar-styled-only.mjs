const DEFAULT_ALLOW = ['scrollbar-styled']

/** Splits `md:hover:[&::x]:scrollbar-thin` into its variants and its utility, ignoring `:` inside brackets. */
const splitVariants = (token) => {
  const parts = []
  let depth = 0
  let start = 0
  for (let i = 0; i < token.length; i++) {
    const char = token[i]
    if (char === '[') depth++
    else if (char === ']') depth--
    else if (char === ':' && depth === 0) {
      parts.push(token.slice(start, i))
      start = i + 1
    }
  }
  parts.push(token.slice(start))
  return parts
}

/** Scrollbar styling written any way other than an allowed utility, e.g. `scrollbar-thin` or `[scrollbar-width:thin]`. */
const isScrollbarClass = (token, allow) => {
  const parts = splitVariants(token)
  const utility = parts.at(-1).replace(/^!|!$/g, '')
  if (allow.includes(utility)) return false
  return (
    /^-?scrollbar-[\w[(]/.test(utility) ||
    /^\[-?(?:webkit-)?scrollbar-/.test(utility) ||
    parts.some((part) => part.includes('::-webkit-scrollbar'))
  )
}

export default {
  meta: {
    type: 'problem',
    schema: [
      {
        type: 'object',
        properties: {
          allow: { type: 'array', items: { type: 'string' } },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      useScrollbarStyled:
        "Use the scrollbar-styled utility instead of '{{className}}', so every scrollbar looks the same.",
    },
  },
  create(context) {
    const allow = context.options[0]?.allow ?? DEFAULT_ALLOW

    const check = (node, text) => {
      if (typeof text !== 'string' || !text.includes('scrollbar')) return
      for (const token of text.split(/\s+/)) {
        if (token && isScrollbarClass(token, allow)) {
          context.report({ node, messageId: 'useScrollbarStyled', data: { className: token } })
        }
      }
    }

    return {
      Literal(node) {
        check(node, node.value)
      },
      TemplateElement(node) {
        check(node, node.value.cooked ?? node.value.raw)
      },
    }
  },
}
