import { RuleTester } from 'vite-plus/lint/plugins-dev'
import { describe, it } from 'vite-plus/test'
import scrollbarStyledOnly from './scrollbar-styled-only.mjs'

RuleTester.describe = describe
RuleTester.it = it

const tester = new RuleTester({
  languageOptions: { parserOptions: { lang: 'tsx' } },
})
const error = (className) => ({ messageId: 'useScrollbarStyled', data: { className } })

tester.run('scrollbar-styled-only', scrollbarStyledOnly, {
  valid: [
    { code: '<div className="scrollbar-styled max-h-80 overflow-y-auto" />' },
    { code: "cn('scrollbar-styled sticky top-0', isOpen && 'hidden')" },
    { code: '<div className={`scrollbar-styled ${extra}`} />' },
    { code: '<div className="md:scrollbar-styled" />' },
    { code: "const label = 'Hide the scrollbar'" },
    { code: "const label = 'scrollbar'" },
    {
      code: '<div className="scrollbar-none" />',
      options: [{ allow: ['scrollbar-styled', 'scrollbar-none'] }],
    },
  ],
  invalid: [
    {
      code: '<div className="scrollbar-thin overflow-y-auto" />',
      errors: [error('scrollbar-thin')],
    },
    {
      code: "cn('border scrollbar-thumb-border/40 hover:scrollbar-thumb-border')",
      errors: [error('scrollbar-thumb-border/40'), error('hover:scrollbar-thumb-border')],
    },
    {
      code: '<div className={`flex ${a} scrollbar-track-transparent`} />',
      errors: [error('scrollbar-track-transparent')],
    },
    { code: '<div className="scrollbar-none" />', errors: [error('scrollbar-none')] },
    {
      code: '<div className="scrollbar-gutter-stable" />',
      errors: [error('scrollbar-gutter-stable')],
    },
    {
      code: '<div className="scrollbar-thumb-[#fff]" />',
      errors: [error('scrollbar-thumb-[#fff]')],
    },
    {
      code: '<div className="[scrollbar-width:thin]" />',
      errors: [error('[scrollbar-width:thin]')],
    },
    {
      code: '<div className="[&::-webkit-scrollbar]:hidden" />',
      errors: [error('[&::-webkit-scrollbar]:hidden')],
    },
    { code: '<div className="!scrollbar-thin" />', errors: [error('!scrollbar-thin')] },
  ],
})
