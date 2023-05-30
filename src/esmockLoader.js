import process from 'process'
import urlDummy from './esmockDummy.js'
import esmockErr from './esmockErr.js'

const [major, minor] = process.versions.node.split('.').map(it => +it)
const isLT1612 = major < 16 || (major === 16 && minor < 12)

const esmkgdefsAndAfterRe = /\?esmkgdefs=.*/
const esmkgdefsAndBeforeRe = /.*\?esmkgdefs=/
const esmkdefsRe = /#-#esmkdefs/
const esmkImportRe = /file:\/\/\/import\?([^#]*)/
const esmkImportListItemRe = /\bimport,|,import\b|\bimport\b/g
const esmkTreeIdRe = /esmkTreeId=\d*/
const esmkModuleIdRe = /esmkModuleId=([^&]*)/
const esmkIdRe = /\?esmk=\d*/
const exportNamesRe = /.*exportNames=(.*)/
const withHashRe = /.*#-#/
const isesmRe = /isesm=true/
const isnotfoundRe = /isfound=false/

const globalPreload = (({ port }) => (
  port.addEventListener('message', ev => (
    global.mockKeys[ev.data.key] = ev.data.keylong)),
  port.unref(),
  'global.postMessageEsmk = d => port.postMessage(d)'
))

const parseImports = defstr => {
  const [specifier, imports] = (defstr.match(esmkImportRe) || [])

  return [ // return [specifier, importNames]
    specifier, exportNamesRe.test(imports) &&
      imports.replace(exportNamesRe, '$1').split(',')]
}

// parses local and global mock imports from long-url treeidspec
const parseImportsTree = treeidspec => {
  const defs = treeidspec.split(esmkdefsRe)[1] || ''
  const defimports = parseImports(defs)
  const gdefs = treeidspec.replace(esmkgdefsAndBeforeRe, '')
  const gdefimports = parseImports(gdefs)

  return [
    defimports[0] || gdefimports[0],
    [...new Set([defimports[1] || [], gdefimports[1] || []].flat())]
  ]
}

const treeidspecFromUrl = url => esmkIdRe.test(url)
  && global.esmockTreeIdGet(url.match(esmkIdRe)[0].split('=')[1])

// new versions of node: when multiple loaders are used and context
// is passed to nextResolve, the process crashes in a recursive call
// see: /esmock/issues/#48
//
// old versions of node: if context.parentURL is defined, and context
// is not passed to nextResolve, the tests fail
//
// later versions of node v16 include 'node-addons'
const nextResolveCall = async (nextResolve, specifier, context) => (
  context.parentURL &&
    (context.conditions.slice(-1)[0] === 'node-addons'
     || context.importAssertions || isLT1612)
    ? nextResolve(specifier, context)
    : nextResolve(specifier))

const resolve = async (specifier, context, nextResolve) => {
  const { parentURL } = context
  const treeidspec = treeidspecFromUrl(parentURL) || parentURL
  if (!esmkTreeIdRe.test(treeidspec))
    return nextResolveCall(nextResolve, specifier, context)

  const [treeid] = String(treeidspec).match(esmkTreeIdRe)
  const [url, defs] = treeidspec.split(esmkdefsRe)
  const gdefs = url && url.replace(esmkgdefsAndBeforeRe, '')
  // do not call 'nextResolve' for notfound modules
  if (treeidspec.includes(`esmkModuleId=${specifier}&isfound=false`)) {
    const moduleIdRe = new RegExp(
      '.*file:///' + specifier + '(\\?' + treeid + '(?:(?!#-#).)*).*')
    const moduleId = (
      gdefs.match(moduleIdRe) || defs.match(moduleIdRe) || [])[1]
    if (moduleId) {
      return {
        shortCircuit: true,
        url: urlDummy + moduleId
      }
    }
  }

  if (specifier.startsWith('file:///import?')) {
    return {
      shortCircuit: true,
      url: specifier.replace('file:///import', urlDummy)
    }
  }

  const resolved = await nextResolveCall(nextResolve, specifier, context)
  const moduleIdRe = new RegExp(
    '.*(' + resolved.url + '\\?' + treeid + '(?:(?!#-#).)*).*')
  const moduleId =
    moduleIdRe.test(defs) && defs.replace(moduleIdRe, '$1') ||
    moduleIdRe.test(gdefs) && gdefs.replace(moduleIdRe, '$1')
  if (moduleId) {
    resolved.url = isesmRe.test(moduleId)
      ? moduleId
      : urlDummy + '#-#' + moduleId
  } else if (gdefs && gdefs !== '0') {
    if (!resolved.url.startsWith('node:')) {
      resolved.url += '?esmkgdefs=' + gdefs
    }
  }

  if (/strict=3/.test(treeidspec) && !moduleId)
    throw esmockErr.errModuleIdNotMocked(resolved.url, treeidspec.split('?')[0])

  return resolved
}

const loaderVerificationQuery = 'esmock-loader=true'
const loaderVerificationURLCreate = url => `${url}?${loaderVerificationQuery}`
const loaderIsVerified = async url =>
  (await import(loaderVerificationURLCreate(url))).default === true
const load = async (url, context, nextLoad) => {
  if (url.endsWith(loaderVerificationQuery)) {
    return {
      format: 'module',
      shortCircuit: true,
      responseURL: url,
      source: 'export default true'
    }
  }

  const treeidspec = treeidspecFromUrl(url) || url
  const treeid = treeidspec &&
    (treeidspec.match(esmkTreeIdRe) || [])[0]
  if (treeid) {
    const [specifier, importedNames] = parseImportsTree(treeidspec)
    if (importedNames && importedNames.length) {
      return {
        format: 'module',
        shortCircuit: true,
        responseURL: encodeURI(url),
        source: `import {${importedNames}} from '${specifier}';`
          + (await nextLoad(url, context)).source
      }
    }
  }

  if (esmkdefsRe.test(url)) // parent of mocked modules
    return nextLoad(url, context)

  url = url.replace(esmkgdefsAndAfterRe, '')
  if (url.startsWith(urlDummy)) {
    url = url.replace(withHashRe, '')
    if (isnotfoundRe.test(url))
      url = url.replace(urlDummy, `file:///${url.match(esmkModuleIdRe)[1]}`)
  }

  const exportedNames = exportNamesRe.test(url) && url
    .replace(exportNamesRe, '$1')
    .replace(esmkImportListItemRe, '')
    .split(',')

  if (exportedNames && exportedNames[0]) {
    return {
      format: 'module',
      shortCircuit: true,
      responseURL: encodeURI(url),
      source: exportedNames.map(name => name === 'default'
        ? `export default global.esmockCacheGet("${url}").default`
        : `export const ${name} = global.esmockCacheGet("${url}").${name}`
      ).join('\n')
    }
  }

  return nextLoad(url, context)
}

// node lt 16.12 require getSource, node gte 16.12 warn remove getSource
const getSource = isLT1612 && load

export {load, resolve, getSource, loaderIsVerified, globalPreload}
