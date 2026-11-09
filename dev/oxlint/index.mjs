import onlyServiceExport from './rules/only-service-export.mjs'
import noServerDeepImports from './rules/no-server-deep-imports.mjs'
import scrollbarStyledOnly from './rules/scrollbar-styled-only.mjs'

export default {
  meta: { name: 'local' },
  rules: {
    'only-service-export': onlyServiceExport,
    'no-server-deep-imports': noServerDeepImports,
    'scrollbar-styled-only': scrollbarStyledOnly,
  },
}
