import 'color'

declare module 'color' {
  interface ColorInstance {
    oklch(): ColorInstance
    oklab(): ColorInstance
  }
}
