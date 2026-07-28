/** Mock mínimo de `res` de Express para probar middlewares/controllers sin HTTP real. */
export function mockResponse() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    end() {
      return this;
    },
  };
}

/** Wrapper de `next` que registra si fue llamado y con qué error. */
export function mockNext() {
  const fn = (err) => {
    fn.called = true;
    fn.error = err;
  };
  fn.called = false;
  fn.error = undefined;
  return fn;
}
