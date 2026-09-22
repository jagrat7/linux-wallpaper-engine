import { RuleTester } from 'oxlint/plugins-dev'
import { describe, it } from 'vitest'
import onlyServiceExport from './only-service-export.mjs'

RuleTester.describe = describe
RuleTester.it = it

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: 'ts' } } })

tester.run('only-service-export', onlyServiceExport, {
  valid: [
    'export type Options = {}; export const settingsService = {}',
    'export interface Options {} export const displayService = {} satisfies Options',
    'class StoreService {} export const storeService = StoreService.getInstance()',
    'export class DisplayService {}',
    'type Options = {}; export type { Options }; export const settingsService = {}',
    'export type * from "./types"; export const settingsService = {}',
  ],
  invalid: [
    {
      code: 'export const settingsService = {}; export const helper = 1',
      errors: [{ messageId: 'invalidExport' }],
    },
    {
      code: 'export const settingsService = {}; export const displayService = {}',
      errors: [{ messageId: 'duplicateService' }],
    },
    {
      code: 'export default {}',
      errors: [{ messageId: 'invalidExport' }],
    },
    {
      code: 'export { helper } from "./helper"',
      errors: [{ messageId: 'invalidExport' }],
    },
    {
      code: 'export * from "./helper"',
      errors: [{ messageId: 'invalidExport' }],
    },
    {
      code: 'export const storeService = OtherService.getInstance()',
      errors: [{ messageId: 'invalidExport' }],
    },
  ],
})
