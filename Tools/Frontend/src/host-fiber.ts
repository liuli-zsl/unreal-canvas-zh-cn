export type HostFiber<Props> = {
  key: string | null;
  return?: HostFiber<Props> | null;
  alternate?: HostFiber<Props> | null;
  memoizedProps?: Props;
};

// Canvas 0.24 uses React keys for some menu rows without exposing a DOM ID.
// Callers keep the source text when the host no longer exposes this shape.
export function renderedFiber<Props>(element: Element): HostFiber<Props> | undefined {
  const property = Object.keys(element).find(key => key.startsWith('__reactFiber$'));
  return property ? Object.getOwnPropertyDescriptor(element, property)?.value : undefined;
}
