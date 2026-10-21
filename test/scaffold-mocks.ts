/** Constructor-only Nest scaffold dependencies. Never instantiate a dependency
 * service, repository, SMTP transport or DataSource. Unexpected calls fail loudly. */
export function scaffoldDependencyMock(token: unknown): Record<string, jest.Mock> {
  const methods = new Set(['find', 'findOne', 'save', 'create', 'update', 'delete', 'query', 'transaction', 'createQueryBuilder']);
  if (typeof token === 'function') {
    for (let proto = token.prototype; proto && proto !== Object.prototype; proto = Object.getPrototypeOf(proto)) {
      for (const name of Object.getOwnPropertyNames(proto)) {
        if (name !== 'constructor' && typeof Object.getOwnPropertyDescriptor(proto, name)?.value === 'function') methods.add(name);
      }
    }
  } else if (typeof token !== 'string' || !token.endsWith('Repository')) {
    throw new Error('Unsupported scaffold dependency: ' + String(token));
  }
  return Object.fromEntries([...methods].map(name => [name, jest.fn(() => { throw new Error('Unexpected scaffold dependency call: ' + name); })]));
}
