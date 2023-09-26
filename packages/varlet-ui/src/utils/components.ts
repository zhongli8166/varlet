import { useEventListener } from '@varlet/use'
import {
  createApp,
  h,
  ref,
  onActivated,
  onDeactivated,
  Comment,
  Fragment,
  computed,
  watch,
  type PropType,
  type ExtractPropTypes,
  type Component,
  type VNode,
  type Ref,
  type WritableComputedRef,
  type ComponentPublicInstance,
  type Plugin,
  type App,
} from 'vue'
import { bigCamelize, isArray } from '@varlet/shared'

export type ListenerProp<F> = F | F[]

export interface MountInstance {
  instance: ComponentPublicInstance
  unmount: () => void
}

export type ExtractPublicPropTypes<P> = Partial<ExtractPropTypes<P>>

export function pickProps<T, U extends keyof T>(props: T, propsKey: U): T[U]
export function pickProps<T, U extends keyof T>(props: T, propsKey: U[]): Pick<T, U>
export function pickProps(props: any, propsKey: any): any {
  return Array.isArray(propsKey)
    ? propsKey.reduce((pickedProps: any, key) => {
        pickedProps[key] = props[key]
        return pickedProps
      }, {})
    : props[propsKey]
}

export type ComponentWithInstall<T> = T & Plugin

export function withInstall<T = Component>(component: Component, target?: T): ComponentWithInstall<T> {
  const componentWithInstall = target ?? component

  ;(componentWithInstall as ComponentWithInstall<T>).install = function (app: App) {
    const { name } = component

    if (name) {
      app.component(name, component)
    }
  }

  return componentWithInstall as ComponentWithInstall<T>
}

export function mount(component: Component): MountInstance {
  const app = createApp(component)
  const host = document.createElement('div')
  document.body.appendChild(host)

  return {
    instance: app.mount(host),
    unmount() {
      app.unmount()
      document.body.removeChild(host)
    },
  }
}

export function mountInstance(
  component: any,
  props: Record<string, any> = {},
  eventListener: Record<string, any> = {}
): {
  unmountInstance: () => void
} {
  const Host = {
    setup() {
      return () =>
        h(component, {
          ...props,
          ...eventListener,
        })
    },
  }

  const { unmount } = mount(Host)
  return { unmountInstance: unmount }
}

export function flatFragment(vNodes: any) {
  const result: VNode[] = []

  vNodes.forEach((vNode: any) => {
    if (vNode.type === Comment) {
      return
    }

    if (vNode.type === Fragment && isArray(vNode.children)) {
      vNode.children.forEach((item: VNode) => {
        result.push(item)
      })
      return
    }

    result.push(vNode)
  })

  return result
}

export function useValidation() {
  const errorMessage: Ref<string> = ref('')

  const validate = async (rules: any, value: any, apis?: any): Promise<boolean> => {
    if (!isArray(rules) || !rules.length) {
      return true
    }

    const resArr = await Promise.all(rules.map((rule) => rule(value, apis)))

    return !resArr.some((res) => {
      if (res !== true) {
        errorMessage.value = String(res)
        return true
      }

      return false
    })
  }

  const resetValidation = () => {
    errorMessage.value = ''
  }

  const validateWithTrigger = async <T>(validateTrigger: T[], trigger: T, rules: any, value: any, apis?: any) => {
    if (validateTrigger.includes(trigger)) {
      ;(await validate(rules, value, apis)) && (errorMessage.value = '')
    }
  }

  return {
    errorMessage,
    validate,
    resetValidation,
    validateWithTrigger,
  }
}

export function useRouteListener(listener: () => void) {
  useEventListener(() => window, 'hashchange', listener)
  useEventListener(() => window, 'popstate', listener)
}

export function useTeleport() {
  const disabled: Ref<boolean> = ref(false)

  onActivated(() => {
    disabled.value = false
  })

  onDeactivated(() => {
    disabled.value = true
  })

  return {
    disabled,
  }
}

export type ClassName = string | undefined | null
export type Classes = (ClassName | [any, ClassName, ClassName?])[]
export type BEM<S extends string | undefined, N extends string, NC extends string> = S extends undefined
  ? NC
  : S extends `$--${infer CM}`
  ? `${N}--${CM}`
  : S extends `--${infer M}`
  ? `${NC}--${M}`
  : `${NC}__${S}`

export function createNamespace<C extends string>(name: C) {
  const namespace = `var` as const
  const componentName = `${namespace}-${name}` as const

  const createBEM = <S extends string | undefined = undefined>(
    suffix?: S
  ): BEM<S, typeof namespace, typeof componentName> => {
    if (!suffix) {
      return componentName as any
    }

    if (suffix[0] === '$') {
      return suffix.replace('$', namespace) as any
    }

    return (suffix.startsWith('--') ? `${componentName}${suffix}` : `${componentName}__${suffix}`) as any
  }

  const classes = (...classes: Classes): any[] =>
    classes.map((className) => {
      if (isArray(className)) {
        const [condition, truthy, falsy = null] = className
        return condition ? truthy : falsy
      }

      return className
    })

  return {
    name: bigCamelize(componentName),
    n: createBEM,
    classes,
  }
}

export function call<P extends any[], R>(
  fn?: ((...arg: P) => R) | ((...arg: P) => R)[] | null,
  ...args: P
): R | R[] | undefined {
  if (isArray(fn)) {
    return fn.map((f) => f(...args))
  }

  if (fn) {
    return fn(...args)
  }
}

export function defineListenerProp<F>(fallback?: any) {
  return {
    type: [Function, Array] as PropType<F | F[]>,
    default: fallback,
  }
}

export function formatElevation(elevation: number | boolean | string, defaultLevel?: number) {
  if (elevation === false) {
    return null
  }

  if (elevation === true && defaultLevel) {
    elevation = defaultLevel
  }

  return `var-elevation--${elevation}`
}

export interface UseVModelOptions<P, K extends keyof P> {
  passive?: boolean
  eventName?: string
  defaultValue?: P[K]
  emit?: (event: string, value: P[K]) => void
}

export function useVModel<P extends Record<string, any>, K extends keyof P>(
  props: P,
  key: K,
  options: UseVModelOptions<P, K> = {}
): WritableComputedRef<P[K]> | Ref<P[K]> {
  const { passive = true, eventName, defaultValue, emit } = options
  const event = eventName ?? `onUpdate:${key.toString()}`

  const getValue = () => (props[key] != null ? props[key] : defaultValue)!

  if (!passive) {
    return computed<P[K]>({
      get() {
        return getValue()
      },
      set(value) {
        emit ? emit(event, value) : call(props[event], value)
      },
    })
  }

  const proxy = ref<P[K]>(getValue())

  watch(
    () => props[key],
    () => {
      proxy.value = getValue()
    }
  )

  watch(
    () => proxy.value,
    (newValue: P[K]) => {
      emit ? emit(event, newValue) : call(props[event], newValue)
    }
  )

  return proxy
}
