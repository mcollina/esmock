import path from 'path';
import url from 'url';

const esmockPathDir = path.dirname(url.fileURLToPath(import.meta.url));

const esmockStringHasPath = str => /(\/[^:]*)/.test(str);

const esmockStringHasPathExternal = str => Boolean(
  esmockStringHasPath(str) && !str.includes(esmockPathDir));

const esmockPathCallee = () => {
  const stackList = new Error().stack.split('\n').slice(1);
  const stackItem = stackList.find(esmockStringHasPathExternal);
  const stackmatch = stackItem.match(/(\/[^:]*)/);

  return stackmatch && stackmatch[1];
};

// not 'core' module or a 'node_module'
const esmockPathFullIsLocalModule = pathFull => (
  /[/.]/.test(pathFull) && !/\/node_modules\//.test(pathFull));

export {
  esmockPathDir,
  esmockPathCallee,
  esmockPathFullIsLocalModule
};
